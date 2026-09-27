import express, { type NextFunction, type Request, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineStep } from '../../src/types';
import { PipelineError, PipelineService, type CreateJobInput } from './service';
import type { StoredJob } from './jobs';

interface AdminRequest extends Request {
  userId?: string | null;
}

/**
 * Only admins may use the pipeline. With Supabase configured the caller must send a
 * valid access token whose profile has role = 'admin'. Without Supabase (local demo)
 * the pipeline is open in development and disabled in production.
 */
export function requireAdmin(supabaseAdmin: SupabaseClient | null, isProduction: boolean) {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!supabaseAdmin) {
      if (isProduction) return res.status(503).json({ error: 'El estudio requiere Supabase configurado en el servidor.' });
      req.userId = null;
      return next();
    }
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Inicia sesión como administrador.' });
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Sesión no válida.' });
    const profile = await supabaseAdmin.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (profile.error) return res.status(500).json({ error: 'No se pudo comprobar el rol.' });
    if (profile.data?.role !== 'admin') return res.status(403).json({ error: 'Solo los administradores pueden usar el Estudio IA.' });
    req.userId = data.user.id;
    next();
  };
}

const MAX_TEXT = 3_000_000;

export function validateCreateJob(body: any): CreateJobInput {
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
  const title = str(body?.title, 200);
  const author = str(body?.author, 200);
  if (!title) throw new PipelineError('El título es obligatorio (máx. 200 caracteres).');
  if (!author) throw new PipelineError('El autor es obligatorio (máx. 200 caracteres).');

  const source_type = body?.source_type;
  if (!['gutenberg', 'wikisource', 'custom_text'].includes(source_type)) throw new PipelineError('Tipo de fuente inválido.');

  const input: CreateJobInput = { title, author, source_type };
  if (source_type === 'custom_text') {
    if (typeof body.raw_text !== 'string' || !body.raw_text.trim()) throw new PipelineError('Pega el texto de la obra.');
    if (body.raw_text.length > MAX_TEXT) throw new PipelineError('El texto es demasiado largo.');
    input.raw_text = body.raw_text;
  } else {
    const url = str(body?.source_url, 500);
    if (!url) throw new PipelineError('Indica la URL de Gutenberg o Wikisource.');
    input.source_url = url;
  }
  if (body?.visual_mode === 'premium' || body?.visual_mode === 'economic') input.visual_mode = body.visual_mode;
  if (body?.drama_episodes !== undefined) {
    const n = Number(body.drama_episodes);
    if (!Number.isInteger(n) || n < 1 || n > 40) throw new PipelineError('El número de episodios debe estar entre 1 y 40.');
    input.drama_episodes = n;
  }
  return input;
}

/** Hides the internal owner id from API responses. */
const publicJob = ({ created_by: _c, ...job }: StoredJob) => job;

export function createPipelineRouter(service: PipelineService, auth: ReturnType<typeof requireAdmin>) {
  const router = express.Router();
  router.use(auth);
  router.use(express.json({ limit: '4mb' }));

  const handle = (fn: (req: AdminRequest, res: Response) => Promise<unknown>) => async (req: AdminRequest, res: Response) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof PipelineError) return res.status(e.status).json({ error: e.message });
      console.error('Error en el pipeline', e);
      res.status(500).json({ error: e instanceof Error ? e.message : 'Error interno del pipeline.' });
    }
  };

  router.get('/status', (_req, res) => res.json({ simulated: service.simulated }));

  router.get('/jobs', handle(async (_req, res) => {
    res.json({ jobs: (await service.listJobs()).map(publicJob) });
  }));

  router.post('/jobs', handle(async (req, res) => {
    const job = await service.createJob(validateCreateJob(req.body), req.userId ?? null);
    res.status(201).json({ job: publicJob(job) });
  }));

  router.get('/jobs/:id', handle(async (req, res) => {
    res.json({ job: publicJob(await service.getJob(req.params.id)) });
  }));

  router.patch('/jobs/:id', handle(async (req, res) => {
    const patch: { visual_mode?: 'economic' | 'premium'; drama_episodes?: number } = {};
    if (req.body?.visual_mode === 'economic' || req.body?.visual_mode === 'premium') patch.visual_mode = req.body.visual_mode;
    if (req.body?.drama_episodes !== undefined) {
      const n = Number(req.body.drama_episodes);
      if (!Number.isInteger(n) || n < 1 || n > 40) throw new PipelineError('El número de episodios debe estar entre 1 y 40.');
      patch.drama_episodes = n;
    }
    res.json({ job: publicJob(await service.updateJob(req.params.id, patch)) });
  }));

  router.post('/jobs/:id/steps/:step', handle(async (req, res) => {
    const job = await service.startStep(req.params.id, req.params.step as PipelineStep);
    res.status(202).json({ job: publicJob(job) });
  }));

  router.post('/jobs/:id/publish', handle(async (req, res) => {
    const { job, bundle } = await service.publish(req.params.id);
    res.json({ job: publicJob(job), bundle });
  }));

  return router;
}
