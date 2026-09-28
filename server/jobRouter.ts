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
      let dbJobId: string | undefined;
      if (admin) {
        const { data: created, error } = await admin.from('production_jobs').insert({
          owner_id:req.userId, project_id:projectId, episode_id:episodeId || null,
          type:name, status:'queued', payload, progress:0
        }).select('id').single();
        if (error || !created) return res.status(500).json({error:'No se pudo registrar el job.'});
        dbJobId=created.id;
      }
      const job=await queue.enqueue(name,{...payload,ownerId:req.userId,dbJobId},{priority:payload.priority});
      if (admin && dbJobId) {
        await admin.from('production_jobs').update({queue_job_id:job.id}).eq('id',dbJobId).eq('owner_id',req.userId);
      }
      res.status(202).json({jobId:job.id,dbJobId,status:'queued'});
    } finally { await queue.close(); }
  });
  router.get('/exports', async (req,res)=>{try{const admin=getAdmin();if(!admin)return res.status(503).json({error:'Supabase required'});const projectId=String(req.query.projectId||'');if(!projectId)return res.status(400).json({error:'projectId required'});const {data,error}=await admin.from('creator_exports').select('*').eq('project_id',projectId).eq('owner_id',req.userId).order('created_at',{ascending:false});if(error)throw error;res.json({exports:data||[]});}catch(e){res.status(500).json({error:e instanceof Error?e.message:'Failed to load exports'});}});
router.get('/exports/:exportId/download', async (req,res)=>{try{const admin=getAdmin();if(!admin)return res.status(503).json({error:'Supabase required'});const {data:x}=await admin.from('creator_exports').select('*').eq('id',req.params.exportId).eq('owner_id',req.userId).maybeSingle();if(!x||x.status!=='ready'||!x.storage_key)return res.status(404).json({error:'Export not ready'});const {data:s,error}=await admin.storage.from('media').createSignedUrl(x.storage_key,300);if(error||!s?.signedUrl)return res.status(404).json({error:'Download unavailable'});res.redirect(s.signedUrl);}catch(e){res.status(500).json({error:e instanceof Error?e.message:'Failed to create download'});}});
router.post('/render', async (req:AuthRequest,res:Response)=>{
    if(!admin) return res.status(503).json({error:'El render requiere Supabase.'});
    const { projectId, episodeId, profileId, scenes, audioStorageKey, subtitleStorageKey } = req.body || {};
    if(typeof projectId !== 'string' || !Array.isArray(scenes) || scenes.length === 0)
      return res.status(400).json({error:'projectId y scenes son obligatorios.'});
    const {data:project}=await admin.from('creator_projects').select('id').eq('id',projectId).eq('owner_id',req.userId).single();
    if(!project) return res.status(404).json({error:'Proyecto no encontrado.'});
    if(episodeId){
      const {data:ep}=await admin.from('creator_episodes').select('id').eq('id',episodeId).eq('project_id',projectId).eq('owner_id',req.userId).single();
      if(!ep) return res.status(404).json({error:'Episodio no encontrado.'});
    }
    const keys=[...scenes.map((s:any)=>typeof s?.storageKey==='string'?s.storageKey:''),audioStorageKey,subtitleStorageKey].filter((x): x is string=>Boolean(x));
    const {data:media}=await admin.from('creator_media').select('storage_key').eq('project_id',projectId).eq('owner_id',req.userId).in('storage_key',keys);
    if((media||[]).length!==keys.length) return res.status(400).json({error:'Uno o más recursos multimedia no pertenecen al proyecto.'});
    const queue=new BullMQProductionQueue();
    try {
      const payload={projectId,episodeId,profileId:typeof profileId==='string'?profileId:'youtube-1080p',
        audioStorageKey:typeof audioStorageKey==='string'?audioStorageKey:null,
        subtitleStorageKey:typeof subtitleStorageKey==='string'?subtitleStorageKey:null,
        scenes:scenes.map((s:any)=>({storageKey:s.storageKey,duration:Math.max(0.5,Math.min(300,Number(s.duration)||5))))};
      const {data:created,error}=await admin.from('production_jobs').insert({
        owner_id:req.userId,project_id:projectId,episode_id:episodeId||null,type:'video.render',status:'queued',payload,progress:0
      }).select('id').single();
      if(error||!created) return res.status(500).json({error:'No se pudo registrar el render.'});
      const job=await queue.enqueue('video.render',{...payload,ownerId:req.userId,dbJobId:created.id},{});
      await admin.from('production_jobs').update({queue_job_id:job.id}).eq('id',created.id).eq('owner_id',req.userId);
      res.status(202).json({jobId:job.id,dbJobId:created.id,status:'queued'});
    } finally { await queue.close(); }
  });

  router.get('/:jobId', async (req:AuthRequest,res:Response)=>{
    if(!admin) return res.status(503).json({error:'Supabase no está configurado.'});
    const {data,error}=await admin.from('production_jobs').select('*').eq('id',req.params.jobId).eq('owner_id',req.userId).single();
    if(error || !data) return res.status(404).json({error:'Job no encontrado.'});
    res.json(data);
  });

  router.post('/:jobId/cancel', async (req:AuthRequest,res:Response)=>{
    if(!admin) return res.status(503).json({error:'Supabase no está configurado.'});
    const {data,error}=await admin.from('production_jobs').select('id,queue_job_id,status').eq('id',req.params.jobId).eq('owner_id',req.userId).single();
    if(error || !data) return res.status(404).json({error:'Job no encontrado.'});
    if(['completed','failed','cancelled'].includes(data.status)) return res.status(409).json({error:'El job ya terminó.'});
    const queue=new BullMQProductionQueue();
    try {
      if(data.queue_job_id) await queue.cancel(data.queue_job_id);
      await admin.from('production_jobs').update({status:'cancelled'}).eq('id',data.id).eq('owner_id',req.userId);
      res.json({status:'cancelled'});
    } finally { await queue.close(); }
  });

  return router;
}
