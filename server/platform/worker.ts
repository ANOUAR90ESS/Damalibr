import { Worker, Job } from 'bullmq';
import { createRedisConnection, CREATOR_QUEUE } from './bullmq';
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { renderVideo } from './ffmpeg';
import { EXPORT_PROFILES } from './types';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseUrl
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

async function updateDb(job: Job, patch: Record<string, unknown>) {
  const dbJobId = (job.data as { dbJobId?: string })?.dbJobId;
  if (!supabase || !dbJobId) return;
  await supabase.from('production_jobs').update(patch).eq('id', dbJobId);
}

async function render(job: Job) {
  if (!supabase) throw new Error('Supabase es obligatorio para renderizar medios en el worker.');
  const payload = job.data as {
    projectId: string; episodeId?: string; profileId?: string; audioStorageKey?: string; subtitleStorageKey?: string;
    scenes: Array<{ storageKey: string; duration: number }>;
  };
  if (!payload.scenes?.length) throw new Error('El render necesita al menos una escena.');

  const profile = EXPORT_PROFILES.find(p => p.id === (payload.profileId || 'youtube-1080p')) || EXPORT_PROFILES[0];
  const temp = path.join(process.env.WORKER_TMP_DIR || '/tmp', 'damalibr-' + job.id);
  await mkdir(temp, { recursive: true });
  try {
    const scenes = [];
    let audioPath: string | undefined;
    let subtitlePath: string | undefined;
    if (payload.audioStorageKey) {
      const { data: audio, error: audioError } = await supabase.storage.from('media').download(payload.audioStorageKey);
      if (audioError || !audio) throw audioError || new Error('No se pudo descargar el audio.');
      audioPath = path.join(temp, 'voice.m4a');
      await writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));
    }
    if (payload.subtitleStorageKey) {
      const { data: subtitle, error: subtitleError } = await supabase.storage.from('media').download(payload.subtitleStorageKey);
      if (subtitleError || !subtitle) throw subtitleError || new Error('No se pudieron descargar los subtítulos.');
      subtitlePath = path.join(temp, 'subtitles.srt');
      await writeFile(subtitlePath, Buffer.from(await subtitle.arrayBuffer()));
    }
    for (let i = 0; i < payload.scenes.length; i++) {
      const source = payload.scenes[i];
      const { data, error } = await supabase.storage.from('media').download(source.storageKey);
      if (error || !data) throw error || new Error('No se pudo descargar la imagen de escena.');
      const imagePath = path.join(temp, `scene-${i}.png`);
      await writeFile(imagePath, Buffer.from(await data.arrayBuffer()));
      scenes.push({ imagePath, duration: source.duration });
      await job.updateProgress(Math.min(20, 5 + Math.floor((i + 1) / payload.scenes.length * 15)));
    }

    const outputPath = path.join(temp, 'render.mp4');
    await renderVideo({
      outputPath, scenes, width: profile.width, height: profile.height, fps: Math.min(profile.maxFps, 30), audioPath, subtitlePath,
      onProgress: async p => job.updateProgress(Math.min(95, 20 + Math.floor(p * 0.75))),
    });

    const output = await readFile(outputPath);
    const storageKey = `projects/${payload.projectId}/video/${job.id}.mp4`;
    const { error: uploadError } = await supabase.storage.from('media').upload(storageKey, output, {
      contentType: 'video/mp4', upsert: true,
    });
    if (uploadError) throw uploadError;

    if (payload.episodeId) {
      await supabase.from('creator_media').insert({
        owner_id: (job.data as { ownerId: string }).ownerId,
        project_id: payload.projectId,
        episode_id: payload.episodeId,
        kind: 'video',
        name: `Render ${profile.label}`,
        storage_key: storageKey,
        mime_type: 'video/mp4',
        size_bytes: output.byteLength,
        status: 'ready',
        metadata: { profileId: profile.id, jobId: job.id },
      });
    }
    return { storageKey, profileId: profile.id, sizeBytes: output.byteLength };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

async function processJob(job: Job) {
  console.log(`[creator-worker] ${job.id} ${job.name} started`);
  await updateDb(job, { status: 'running', started_at: new Date().toISOString(), progress: 5 });
  await job.updateProgress(10);

  try {
    const result = job.name === 'video.render' || job.name === 'export.create'
      ? await render(job)
      : { status: 'accepted', type: job.name };

    await job.updateProgress(100);
    await updateDb(job, { status: 'completed', progress: 100, result, completed_at: new Date().toISOString() });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDb(job, { status: 'failed', error: message });
    throw error;
  }
}

const worker = new Worker(CREATOR_QUEUE, processJob, {
  connection: createRedisConnection(),
  concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
});

worker.on('completed', job => console.log(`[creator-worker] ${job.id} completed`));
worker.on('failed', (job, error) => console.error(`[creator-worker] ${job?.id} failed`, error));
console.log(`[creator-worker] listening on ${CREATOR_QUEUE}`);

process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
process.on('SIGINT', async () => { await worker.close(); process.exit(0); });
