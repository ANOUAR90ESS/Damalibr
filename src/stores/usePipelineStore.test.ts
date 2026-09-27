// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineJob } from '../types';

const api = vi.hoisted(() => ({
  status: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), runStep: vi.fn(), publish: vi.fn(),
}));
vi.mock('../lib/api/pipeline', () => ({ pipelineApi: api }));

const { usePipelineStore } = await import('./usePipelineStore');
const { useCatalogStore } = await import('./useCatalogStore');

const job = (patch: Partial<PipelineJob> = {}): PipelineJob => ({
  id: 'job-1', book_title: 'Bodas', author: 'Lorca', source_type: 'custom_text', current_step: 'ingest',
  status: 'idle', progress: 0, logs: [], ...patch,
});

describe('usePipelineStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    usePipelineStore.setState({ job: null, jobs: [], error: null, busy: false });
  });
  afterEach(() => vi.useRealTimers());

  it('creates a job, starts ingest and polls until the step finishes', async () => {
    api.create.mockResolvedValue(job());
    api.runStep.mockResolvedValue(job({ status: 'running', progress: 2 }));
    api.get
      .mockResolvedValueOnce(job({ status: 'running', progress: 6 }))
      .mockResolvedValueOnce(job({ status: 'idle', current_step: 'analyze', progress: 10 }));

    await usePipelineStore.getState().createJob({ title: 'Bodas', author: 'Lorca', source_type: 'custom_text', raw_text: 'x' });
    expect(api.runStep).toHaveBeenCalledWith('job-1', 'ingest');
    expect(usePipelineStore.getState().job?.status).toBe('running');

    await vi.advanceTimersByTimeAsync(1500);
    expect(usePipelineStore.getState().job?.progress).toBe(6);
    await vi.advanceTimersByTimeAsync(1500);
    expect(usePipelineStore.getState().job).toMatchObject({ current_step: 'analyze', status: 'idle' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.get).toHaveBeenCalledTimes(2); // stopped polling
    expect(JSON.parse(localStorage.getItem('lamina_pipeline_job_id')!)).toBe('job-1');
  });

  it('surfaces API errors (e.g. not an admin)', async () => {
    api.create.mockRejectedValue(new Error('Solo los administradores pueden usar el Estudio IA.'));
    await usePipelineStore.getState().createJob({ title: 'x', author: 'y', source_type: 'custom_text', raw_text: 'z' });
    expect(usePipelineStore.getState().error).toMatch(/administradores/);
  });

  it('adds the published book to the local catalog', async () => {
    usePipelineStore.setState({ job: job({ current_step: 'review', status: 'waiting_review' }) });
    const book = { ...useCatalogStore.getState().books[0], id: 'book-bodas', title: 'Bodas' };
    api.publish.mockResolvedValue({
      job: job({ current_step: 'published', status: 'completed', progress: 100 }),
      bundle: { book, characters: [], adaptations: [], episodes: {} },
    });
    const res = await usePipelineStore.getState().publish();
    expect(res).toMatchObject({ ok: true, bookId: 'book-bodas' });
    expect(useCatalogStore.getState().books[0].id).toBe('book-bodas');
    expect(JSON.parse(localStorage.getItem('lamina_published_catalog')!)).toHaveLength(1);
  });
});
