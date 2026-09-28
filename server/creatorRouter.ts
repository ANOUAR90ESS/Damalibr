import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AuthRequest extends Request { userId?: string; }

function requireUser(admin: SupabaseClient | null, production: boolean) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!admin) {
      if (production) return res.status(503).json({ error: 'Creator Studio requiere Supabase.' });
      req.userId = 'local-dev';
      return next();
    }
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Inicia sesión para usar Creator Studio.' });
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Sesión no válida.' });
    req.userId = data.user.id;
    next();
  };
}

const clean = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null;

export function createCreatorRouter(admin: SupabaseClient | null, production: boolean) {
  const router = express.Router();
  router.use(express.json({ limit: '100kb' }));
  router.use(requireUser(admin, production));

  router.get('/projects', async (req: AuthRequest, res) => {
    if (!admin) return res.json({ projects: [] });
    const { data, error } = await admin.from('creator_projects')
      .select('*').eq('owner_id', req.userId).order('updated_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'No se pudieron cargar los proyectos.' });
    res.json({ projects: data || [] });
  });

  router.post('/projects', async (req: AuthRequest, res) => {
    const title = clean(req.body?.title, 200);
    const type = clean(req.body?.type, 40) || 'story';
    const language = clean(req.body?.language, 20) || 'es';
    const description = clean(req.body?.description, 2000);
    const allowed = ['story','book','series','short_film','microdrama','audiobook'];
    if (!title) return res.status(400).json({ error: 'El título es obligatorio.' });
    if (!allowed.includes(type)) return res.status(400).json({ error: 'Tipo de proyecto inválido.' });
    if (!admin) return res.status(201).json({ project: { id: crypto.randomUUID(), owner_id: req.userId, title, type, language, description, status: 'draft' } });
    const { data, error } = await admin.from('creator_projects')
      .insert({ owner_id: req.userId, title, type, language, description, status: 'draft', metadata: {} })
      .select('*').single();
    if (error) return res.status(500).json({ error: 'No se pudo crear el proyecto.' });
    res.status(201).json({ project: data });
  });

  router.get('/projects/:projectId', async (req: AuthRequest, res) => {
    if (!admin) return res.status(404).json({ error: 'Proyecto no encontrado.' });
    const { data, error } = await admin.from('creator_projects')
      .select('*, creator_episodes(*)').eq('id', req.params.projectId).eq('owner_id', req.userId).single();
    if (error || !data) return res.status(404).json({ error: 'Proyecto no encontrado.' });
    res.json({ project: data });
  });

  router.post('/projects/:projectId/episodes', async (req: AuthRequest, res) => {
    const title = clean(req.body?.title, 200);
    const description = clean(req.body?.description, 2000);
    if (!title) return res.status(400).json({ error: 'El título del episodio es obligatorio.' });
    if (!admin) return res.status(201).json({ episode: { id: crypto.randomUUID(), title, status: 'draft' } });
    const { data: project } = await admin.from('creator_projects').select('id').eq('id', req.params.projectId).eq('owner_id', req.userId).single();
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });
    const { data, error } = await admin.from('creator_episodes')
      .insert({ project_id: project.id, owner_id: req.userId, title, description, status: 'draft', metadata: {} })
      .select('*').single();
    if (error) return res.status(500).json({ error: 'No se pudo crear el episodio.' });
    res.status(201).json({ episode: data });
  });

  return router;
}
