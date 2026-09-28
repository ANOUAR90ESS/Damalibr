import express, { type NextFunction, type Request, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BullMQProductionQueue } from './platform/bullmq';

interface AuthRequest extends Request { userId?: string; }

function auth(admin: SupabaseClient | null, production: boolean) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!admin) {
      if (production) return res.status(503).json({ error: 'Jobs requieren Supabase.' });
      req.userId = 'local-dev'; return next();
    }
    const token=req.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!token) return res.status(401).json({ error:'Inicia sesión.' });
    const {data,error}=await admin.auth.getUser(token);
    if(error||!data.user) return res.status(401).json({error:'Sesión no válida.'});
    req.userId=data.user.id; next();
  };
}

export function createJobRouter(admin: SupabaseClient|null, production: boolean) {
  const router=express.Router();
  router.use(express.json({limit:'100kb'}));
  router.use(auth(admin,production));

  router.post('/', async (req:AuthRequest,res:Response)=>{
    const name=typeof req.body?.name==='string'?req.body.name.trim():''; const payload=req.body?.payload||{};
    const allowed=['story.generate','characters.generate','script.generate','scenes.generate','image.generate','voice.generate','video.generate','subtitle.generate','video.render','export.create'];
    if(!allowed.includes(name)) return res.status(400).json({error:'Tipo de job no permitido.'});
    if(!admin) return res.status(503).json({error:'Redis no está configurado en modo local.'});
    const projectId=payload.projectId; const episodeId=payload.episodeId;
    if(!projectId) return res.status(400).json({error:'projectId es obligatorio.'});
    const {data}=await admin.from('creator_projects').select('id').eq('id',projectId).eq('owner_id',req.userId).single();
    if(!data) return res.status(404).json({error:'Proyecto no encontrado.'});
    if(episodeId){
      const {data:ep}=await admin.from('creator_episodes').select('id').eq('id',episodeId).eq('project_id',projectId).eq('owner_id',req.userId).single();
      if(!ep) return res.status(404).json({error:'Episodio no encontrado.'});
    }
    const queue=new BullMQProductionQueue();
    try {
      const job=await queue.enqueue(name,{...payload,ownerId:req.userId},{priority:payload.priority});
      res.status(202).json({jobId:job.id,status:'queued'});
    } finally { await queue.close(); }
  });
  return router;
}
