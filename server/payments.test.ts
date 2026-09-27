import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import Stripe from 'stripe';
import { createCheckoutSession, handleStripeEvent, type PaymentsDeps } from './payments';
import { createPaymentsRouter } from './paymentsRouter';

const USER = '11111111-1111-1111-1111-111111111111';
const WEBHOOK_SECRET = 'whsec_test_secret';

function makeDeps() {
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const getUser = vi.fn(async (token: string) =>
    token === 'good-token'
      ? { data: { user: { id: USER, email: 'ana@example.com' } }, error: null }
      : { data: { user: null }, error: new Error('invalid') });
  const create = vi.fn(async () => ({ url: 'https://checkout.stripe.test/session' }));
  const retrieve = vi.fn(async () => ({
    id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { user_id: USER },
    items: { data: [{ current_period_end: 1_900_000_000 }] },
  }));
  const stripe = new Stripe('sk_test_dummy');
  (stripe.checkout.sessions as any).create = create;
  (stripe.subscriptions as any).retrieve = retrieve;
  const deps = { stripe, supabaseAdmin: { rpc, auth: { getUser } } } as unknown as PaymentsDeps;
  return { deps, rpc, getUser, create, retrieve, stripe };
}

const event = (type: string, object: object) => ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event;

describe('handleStripeEvent', () => {
  it('credits coins once a coin checkout is paid, using server-side prices', async () => {
    const { deps, rpc } = makeDeps();
    await handleStripeEvent(deps, event('checkout.session.completed', {
      id: 'cs_1', payment_status: 'paid', amount_total: 499, metadata: { user_id: USER, product: 'coins_150' },
    }));
    expect(rpc).toHaveBeenCalledWith('credit_coin_purchase', {
      p_user: USER, p_session_id: 'cs_1', p_product: 'coins_150', p_coins: 150, p_amount_cents: 499,
    });
  });

  it('waits for async payments before crediting coins', async () => {
    const { deps, rpc } = makeDeps();
    await handleStripeEvent(deps, event('checkout.session.completed', {
      id: 'cs_2', payment_status: 'unpaid', metadata: { user_id: USER, product: 'coins_50' },
    }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ignores sessions with unknown products or no user', async () => {
    const { deps, rpc } = makeDeps();
    await handleStripeEvent(deps, event('checkout.session.completed', { id: 'cs_3', payment_status: 'paid', metadata: { user_id: USER, product: 'coins_9999' } }));
    await handleStripeEvent(deps, event('checkout.session.completed', { id: 'cs_4', payment_status: 'paid', metadata: { product: 'coins_50' } }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('activates VIP from a subscription checkout', async () => {
    const { deps, rpc, retrieve } = makeDeps();
    await handleStripeEvent(deps, event('checkout.session.completed', {
      id: 'cs_5', mode: 'subscription', subscription: 'sub_1', metadata: { user_id: USER, product: 'vip_monthly' },
    }));
    expect(retrieve).toHaveBeenCalledWith('sub_1');
    expect(rpc).toHaveBeenCalledWith('sync_vip_subscription', {
      p_user: USER, p_active: true, p_period_end: new Date(1_900_000_000 * 1000).toISOString(),
      p_customer_id: 'cus_1', p_subscription_id: 'sub_1',
    });
  });

  it('deactivates VIP when the subscription is deleted', async () => {
    const { deps, rpc } = makeDeps();
    await handleStripeEvent(deps, event('customer.subscription.deleted', {
      id: 'sub_1', status: 'canceled', customer: { id: 'cus_1' }, metadata: { user_id: USER }, items: { data: [] },
    }));
    expect(rpc).toHaveBeenCalledWith('sync_vip_subscription', expect.objectContaining({ p_active: false, p_period_end: null, p_customer_id: 'cus_1' }));
  });

  it('throws when the database call fails so Stripe retries', async () => {
    const { deps, rpc } = makeDeps();
    rpc.mockResolvedValueOnce({ data: null, error: new Error('db down') } as any);
    await expect(handleStripeEvent(deps, event('checkout.session.completed', {
      id: 'cs_6', payment_status: 'paid', metadata: { user_id: USER, product: 'coins_50' },
    }))).rejects.toThrow('db down');
  });
});

describe('createCheckoutSession', () => {
  it('builds a one-off payment for coins and a monthly subscription for VIP', async () => {
    const { deps, create } = makeDeps();
    await createCheckoutSession(deps, { userId: USER, productId: 'coins_400', appUrl: 'https://app.test' });
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({
      mode: 'payment',
      client_reference_id: USER,
      metadata: { user_id: USER, product: 'coins_400' },
      success_url: 'https://app.test/profile?checkout=success',
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 999, currency: 'eur' }) })],
    }));

    await createCheckoutSession(deps, { userId: USER, productId: 'vip_monthly', appUrl: 'https://app.test' });
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({
      mode: 'subscription',
      subscription_data: { metadata: { user_id: USER, product: 'vip_monthly' } },
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ recurring: { interval: 'month' } }) })],
    }));
  });
});

describe('payments router', () => {
  let server: Server;
  let base: string;
  const ctx = makeDeps();

  beforeAll(async () => {
    const app = express();
    app.use('/api', createPaymentsRouter(ctx.deps, WEBHOOK_SECRET));
    app.use('/off', createPaymentsRouter(null, undefined));
    server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());
  beforeEach(() => vi.clearAllMocks());

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('rejects webhooks with an invalid signature', async () => {
    const res = await post('/api/stripe/webhook', '{}', { 'stripe-signature': 't=1,v1=bad' });
    expect(res.status).toBe(400);
    expect(ctx.rpc).not.toHaveBeenCalled();
  });

  it('processes webhooks signed with the endpoint secret', async () => {
    const payload = JSON.stringify({
      id: 'evt_1', object: 'event', type: 'checkout.session.completed',
      data: { object: { id: 'cs_9', payment_status: 'paid', amount_total: 199, metadata: { user_id: USER, product: 'coins_50' } } },
    });
    const signature = ctx.stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const res = await post('/api/stripe/webhook', payload, { 'stripe-signature': signature });
    expect(res.status).toBe(200);
    expect(ctx.rpc).toHaveBeenCalledWith('credit_coin_purchase', expect.objectContaining({ p_session_id: 'cs_9', p_coins: 50 }));
  });

  it('requires a valid Supabase session to start a checkout', async () => {
    expect((await post('/api/checkout', { productId: 'coins_50' })).status).toBe(401);
    expect((await post('/api/checkout', { productId: 'coins_50' }, { authorization: 'Bearer bad' })).status).toBe(401);
    expect(ctx.create).not.toHaveBeenCalled();
  });

  it('returns the Stripe Checkout URL for a known product', async () => {
    const res = await post('/api/checkout', { productId: 'coins_150' }, { authorization: 'Bearer good-token' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/session' });
    expect(ctx.create).toHaveBeenCalledWith(expect.objectContaining({ client_reference_id: USER, customer_email: 'ana@example.com' }));
  });

  it('rejects unknown products', async () => {
    const res = await post('/api/checkout', { productId: 'coins_1000000' }, { authorization: 'Bearer good-token' });
    expect(res.status).toBe(400);
  });

  it('answers 503 when payments are not configured', async () => {
    expect((await post('/off/checkout', { productId: 'coins_50' }, { authorization: 'Bearer good-token' })).status).toBe(503);
    expect((await post('/off/stripe/webhook', '{}')).status).toBe(503);
  });
});
