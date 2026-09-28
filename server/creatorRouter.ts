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


  router.get('/projects/:projectId/characters', async (req: AuthRequest, res) => {
    if (!admin) return res.json({ characters: [] });
    const { data, error } = await admin.from('creator_characters').select('*').eq('project_id', req.params.projectId).eq('owner_id', req.userId).order('created_at');
    if (error) return res.status(500).json({ error: 'No se pudieron cargar los personajes.' });
    res.json({ characters: data || [] });
  });

  router.post('/projects/:projectId/characters', async (req: AuthRequest, res) => {
    const name = clean(req.body?.name, 160);
    if (!name) return res.status(400).json({ error: 'El nombre del personaje es obligatorio.' });
    if (!admin) return res.status(201).json({ character: { id: crypto.randomUUID(), name } });
    const { data: project } = await admin.from('creator_projects').select('id').eq('id', req.params.projectId).eq('owner_id', req.userId).single();
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });
    const { data, error } = await admin.from('creator_characters').insert({
      project_id: project.id, owner_id: req.userId, name,
      description: clean(req.body?.description, 2000), personality: clean(req.body?.personality, 2000), metadata: {}
    }).select('*').single();
    if (error) return res.status(500).json({ error: 'No se pudo crear el personaje.' });
    res.status(201).json({ character: data });
  });

  router.get('/episodes/:episodeId', async (req: AuthRequest, res) => {
    if (!admin) return res.status(404).json({ error: 'Episodio no encontrado.' });
    const { data, error } = await admin.from('creator_episodes').select('*, creator_scenes(*)').eq('id', req.params.episodeId).eq('owner_id', req.userId).single();
    if (error || !data) return res.status(404).json({ error: 'Episodio no encontrado.' });
    res.json({ episode: data });
  });

  router.patch('/episodes/:episodeId', async (req: AuthRequest, res) => {
    if (!admin) return res.status(404).json({ error: 'Episodio no encontrado.' });
    const patch: Record<string, unknown> = {};
    if (typeof req.body?.title === 'string') patch.title = clean(req.body.title, 200);
    if (typeof req.body?.description === 'string') patch.description = clean(req.body.description, 2000);
    if (req.body?.script !== undefined) patch.script = req.body.script;
    const { data, error } = await admin.from('creator_episodes').update(patch).eq('id', req.params.episodeId).eq('owner_id', req.userId).select('*').single();
    if (error || !data) return res.status(404).json({ error: 'No se pudo actualizar el episodio.' });
    res.json({ episode: data });
  });

  router.get('/episodes/:episodeId/scenes', async (req: AuthRequest, res) => {
    if (!admin) return res.json({ scenes: [] });
    const { data, error } = await admin.from('creator_scenes').select('*').eq('episode_id', req.params.episodeId).eq('owner_id', req.userId).order('scene_order');
    if (error) return res.status(500).json({ error: 'No se pudieron cargar las escenas.' });
    res.json({ scenes: data || [] });
  });

  router.post('/episodes/:episodeId/scenes', async (req: AuthRequest, res) => {
    const title = clean(req.body?.title, 200);
    if (!title) return res.status(400).json({ error: 'El título de la escena es obligatorio.' });
    if (!admin) return res.status(201).json({ scene: { id: crypto.randomUUID(), title, scene_order: 1, script: { text: req.body?.script || '' } } });
    const { data: episode } = await admin.from('creator_episodes').select('id').eq('id', req.params.episodeId).eq('owner_id', req.userId).single();
    if (!episode) return res.status(404).json({ error: 'Episodio no encontrado.' });
    const { count } = await admin.from('creator_scenes').select('id', { count: 'exact', head: true }).eq('episode_id', episode.id).eq('owner_id', req.userId);
    const { data, error } = await admin.from('creator_scenes').insert({
      episode_id: episode.id, owner_id: req.userId, title, scene_order: (count || 0) + 1,
      script: { text: typeof req.body?.script === 'string' ? req.body.script : '' }, metadata: {}
    }).select('*').single();
    if (error) return res.status(500).json({ error: 'No se pudo crear la escena.' });
    res.status(201).json({ scene: data });
  });

  router.get('/projects/:projectId/media', async (req: AuthRequest, res) => {
    if (!admin) return res.json({ media: [] });
    const { data, error } = await admin.from('creator_media').select('*').eq('project_id', req.params.projectId).eq('owner_id', req.userId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'No se pudo cargar la biblioteca multimedia.' });
    res.json({ media: data || [] });
  });

  return router;
}
