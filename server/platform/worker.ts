import { Worker, Job } from 'bullmq';
import { createRedisConnection, CREATOR_QUEUE } from './bullmq';

async function processJob(job: Job) {
  console.log(`[creator-worker] ${job.id} ${job.name} started`);
  await job.updateProgress(10);

  switch (job.name) {
    case 'video.render':
    case 'export.create':
      // Heavy FFmpeg execution will be attached here in the next rendering step.
      await job.updateProgress(100);
      return { status: 'ready', type: job.name };
    default:
      await job.updateProgress(100);
      return { status: 'accepted', type: job.name };
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
