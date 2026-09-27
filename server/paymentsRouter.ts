import express, { type Request, type Response, type NextFunction } from 'express';
import type { PaymentsDeps } from './payments';
import { createBillingPortalSession, createCheckoutSession, handleStripeEvent } from './payments';
import { getProduct } from '../src/lib/products';

interface AuthedRequest extends Request {
  user?: { id: string; email?: string };
}

const NOT_CONFIGURED = { error: 'Los pagos no están configurados en este servidor.' };

function appUrlFor(req: Request): string {
  const configured = process.env.APP_URL;
  if (configured && configured !== 'MY_APP_URL') return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

// Routes: POST /checkout, POST /billing-portal (JSON, need a Supabase access token)
// and POST /stripe/webhook (raw body, verified with the Stripe signature).
// `deps` is null when Stripe or the Supabase service role are not configured.
export function createPaymentsRouter(deps: PaymentsDeps | null, webhookSecret: string | undefined) {
  const router = express.Router();

  // Must see the raw body for signature verification, so it is registered before express.json().
  router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!deps || !webhookSecret) return res.status(503).json(NOT_CONFIGURED);

    let event;
    try {
      event = deps.stripe.webhooks.constructEvent(req.body, req.get('stripe-signature') || '', webhookSecret);
    } catch (e: any) {
      return res.status(400).json({ error: `Firma de webhook inválida: ${e.message}` });
    }

    try {
      await handleStripeEvent(deps, event);
      res.json({ received: true });
    } catch (e: any) {
      console.error('Error procesando webhook de Stripe', event.type, e);
      res.status(500).json({ error: 'Error procesando el evento' }); // Stripe will retry
    }
  });

  const json = express.json({ limit: '10kb' });

  const requireUser = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!deps) return res.status(503).json(NOT_CONFIGURED);
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    const { data, error } = await deps.supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Sesión no válida. Vuelve a iniciar sesión.' });
    req.user = { id: data.user.id, email: data.user.email ?? undefined };
    next();
  };

  router.post('/checkout', json, requireUser, async (req: AuthedRequest, res) => {
    const product = getProduct(req.body?.productId);
    if (!product) return res.status(400).json({ error: 'Producto desconocido.' });
    try {
      const url = await createCheckoutSession(deps!, {
        userId: req.user!.id,
        email: req.user!.email,
        productId: product.id,
        appUrl: appUrlFor(req),
      });
      res.json({ url });
    } catch (e) {
      console.error('Error creando la sesión de pago', e);
      res.status(502).json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' });
    }
  });

  router.post('/billing-portal', json, requireUser, async (req: AuthedRequest, res) => {
    try {
      const url = await createBillingPortalSession(deps!, { userId: req.user!.id, appUrl: appUrlFor(req) });
      if (!url) return res.status(404).json({ error: 'No tienes una suscripción de pago que gestionar.' });
      res.json({ url });
    } catch (e) {
      console.error('Error creando el portal de facturación', e);
      res.status(502).json({ error: 'No se pudo abrir la gestión de la suscripción.' });
    }
  });

  return router;
}
