import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getProduct, ProductId } from '../src/lib/products';

export interface PaymentsDeps {
  stripe: Stripe;
  supabaseAdmin: SupabaseClient;
}

export async function createCheckoutSession(
  { stripe }: PaymentsDeps,
  { userId, email, productId, appUrl }: { userId: string; email?: string; productId: ProductId; appUrl: string },
): Promise<string> {
  const product = getProduct(productId);
  if (!product) throw new Error('Producto desconocido');

  const metadata = { user_id: userId, product: product.id };
  const common = {
    client_reference_id: userId,
    customer_email: email,
    metadata,
    success_url: `${appUrl}/profile?checkout=success`,
    cancel_url: `${appUrl}/profile?checkout=cancelled`,
  };

  const session = product.kind === 'vip'
    ? await stripe.checkout.sessions.create({
        ...common,
        mode: 'subscription',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: product.priceCents,
            recurring: { interval: 'month' },
            product_data: { name: 'Lámina VIP (mensual)' },
          },
        }],
        subscription_data: { metadata },
      })
    : await stripe.checkout.sessions.create({
        ...common,
        mode: 'payment',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: product.priceCents,
            product_data: { name: `${product.coins} monedas Lámina` },
          },
        }],
      });

  if (!session.url) throw new Error('Stripe no devolvió la URL de pago');
  return session.url;
}

export async function createBillingPortalSession(
  { stripe, supabaseAdmin }: PaymentsDeps,
  { userId, appUrl }: { userId: string; appUrl: string },
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.stripe_customer_id) return null;

  const portal = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${appUrl}/profile`,
  });
  return portal.url;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id ?? null);

async function syncSubscription({ supabaseAdmin }: PaymentsDeps, sub: Stripe.Subscription, fallbackUserId?: string) {
  const userId = sub.metadata?.user_id || fallbackUserId;
  if (!userId) {
    console.warn(`Suscripción ${sub.id} sin user_id en metadata; se ignora.`);
    return;
  }
  const periodEnd = sub.items.data[0]?.current_period_end;
  const { error } = await supabaseAdmin.rpc('sync_vip_subscription', {
    p_user: userId,
    p_active: sub.status === 'active' || sub.status === 'trialing',
    p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    p_customer_id: idOf(sub.customer),
    p_subscription_id: sub.id,
  });
  if (error) throw error;
}

// Applies a verified Stripe event to the database. Safe to call more than once
// for the same event (Stripe retries): coin credits are idempotent per session.
export async function handleStripeEvent(deps: PaymentsDeps, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      const userId = session.metadata?.user_id || session.client_reference_id;
      const product = getProduct(session.metadata?.product);
      if (!userId || !product) {
        console.warn(`Checkout ${session.id} sin usuario o producto válido; se ignora.`);
        return;
      }

      if (product.kind === 'coins') {
        if (session.payment_status !== 'paid') return; // async payments arrive later
        const { error } = await deps.supabaseAdmin.rpc('credit_coin_purchase', {
          p_user: userId,
          p_session_id: session.id,
          p_product: product.id,
          p_coins: product.coins,
          p_amount_cents: session.amount_total ?? product.priceCents,
        });
        if (error) throw error;
        return;
      }

      const subscriptionId = idOf(session.subscription);
      if (subscriptionId) {
        const sub = await deps.stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(deps, sub, userId);
      }
      return;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(deps, event.data.object);
      return;

    default:
      return;
  }
}
