import express, { type NextFunction, type Request, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaStore } from './pipeline/media';

interface MediaRequest extends Request {
  userId?: string;
}

function createRequireUser(supabaseAdmin: SupabaseClient | null, isProduction: boolean) {
  return async (req: MediaRequest, res: Response, next: NextFunction) => {
    // Local development can still use the media endpoint without Supabase.
    if (!supabaseAdmin) {
      if (isProduction) return res.status(503).json({ error: 'El acceso a medios requiere Supabase configurado.' });
      return next();
    }

    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Inicia sesión para acceder al contenido.' });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Sesión no válida.' });

    req.userId = data.user.id;
    next();
  };
}

function safeKey(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 500) return null;
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..') || normalized.includes('\0')) return null;
  return normalized;
}

/**
 * Protected media gateway.
 *
 * Supabase mode: authenticates the caller, creates a 2-minute signed Storage URL
 * and redirects to it. Local mode: reads from the server filesystem.
 *
 * Creator media is owner-scoped by creator_media.storage_key. Published/consumer
 * entitlement rules can be layered separately without weakening creator isolation.
 */
export function createMediaRouter(
  store: MediaStore,
  supabaseAdmin: SupabaseClient | null,
  isProduction: boolean,
) {
  const router = express.Router();
  router.get('/', createRequireUser(supabaseAdmin, isProduction), async (req: MediaRequest, res: Response) => {
    const key = safeKey(req.query.key);
    if (!key) return res.status(400).json({ error: 'Clave de medio inválida.' });

    try {
      if (supabaseAdmin && req.userId && key.startsWith('projects/')) {
        const { data: media, error: mediaError } = await supabaseAdmin
          .from('creator_media')
          .select('id, owner_id, storage_key')
          .eq('storage_key', key)
          .maybeSingle();
        if (mediaError) throw mediaError;
        if (media && media.owner_id !== req.userId) {
          return res.status(403).json({ error: 'No tienes acceso a este medio.' });
        }
      }

      if (store.getSignedUrl) {
        const signedUrl = await store.getSignedUrl(key, 120);
        return res.redirect(302, signedUrl);
      }

      const data = await store.read(key);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(data);
    } catch (error) {
      console.error('Error sirviendo medio protegido', error);
      res.status(404).json({ error: 'Medio no encontrado.' });
    }
  });

  return router;
}
