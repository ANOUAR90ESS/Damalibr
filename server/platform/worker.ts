import { Worker, Job } from 'bullmq';
import { createRedisConnection, CREATOR_QUEUE } from './bullmq';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseUrl
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

async function updateDb(job: Job, patch: Record<string, unknown>) {
  const dbJobId = (job.data as { dbJobId?: string })?.dbJobId;
  if (!supabase || !dbJobId) return;
  await supabase.from('production_jobs').update(patch).eq('id', dbJobId);
}

async function processJob(job: Job) {
  console.log(`[creator-worker] ${job.id} ${job.name} started`);
  await updateDb(job, { status: 'running', started_at: new Date().toISOString(), progress: 5 });
  await job.updateProgress(10);

  try {
    switch (job.name) {
      case 'video.render':
      case 'export.create':
        // FFmpeg execution is attached in the rendering phase.
        await job.updateProgress(100);
        await updateDb(job, { status: 'completed', progress: 100, result: { status: 'ready', type: job.name }, completed_at: new Date().toISOString() });
        return { status: 'ready', type: job.name };
      default:
        await job.updateProgress(100);
        await updateDb(job, { status: 'completed', progress: 100, result: { status: 'accepted', type: job.name }, completed_at: new Date().toISOString() });
        return { status: 'accepted', type: job.name };
    }
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
