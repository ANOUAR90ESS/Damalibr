export interface JobQueue<T = unknown> {
  enqueue(name: string, payload: T, options?: { jobId?: string; priority?: number; delayMs?: number }): Promise<{ id: string }>;
}

/** Adapter boundary for BullMQ. Application code must depend on this interface. */
export interface ProductionQueue extends JobQueue {
  pause(jobId: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
  retry(jobId: string): Promise<void>;
}
