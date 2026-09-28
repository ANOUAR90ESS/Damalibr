import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { ProductionQueue } from './jobs';

export const CREATOR_QUEUE = 'damalibr-creator';

export function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export class BullMQProductionQueue implements ProductionQueue {
  private readonly queue: Queue;

  constructor(private readonly connection = createRedisConnection()) {
    this.queue = new Queue(CREATOR_QUEUE, { connection: this.connection });
  }

  async enqueue(name: string, payload: unknown, options: { jobId?: string; priority?: number; delayMs?: number } = {}) {
    const job = await this.queue.add(name, payload, {
      jobId: options.jobId,
      priority: options.priority,
      delay: options.delayMs,
      removeOnComplete: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnFail: 500,
    });
    return { id: job.id! };
  }

  async pause(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) await job.moveToDelayed(Date.now() + 365 * 24 * 60 * 60 * 1000, job.token);
  }

  async cancel(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) await job.remove();
  }

  async retry(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) await job.retry('failed');
  }

  async close() {
    await this.queue.close();
    await this.connection.quit();
  }
}
