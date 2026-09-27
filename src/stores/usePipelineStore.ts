import { create } from 'zustand';
import { PipelineJob } from '../types';
import { storageService } from '../lib/supabase';
import { CreatePipelineJobInput, pipelineApi } from '../lib/api/pipeline';
import { useCatalogStore } from './useCatalogStore';

const POLL_MS = 1500;
const JOB_KEY = 'pipeline_job_id';

interface PipelineState {
  job: PipelineJob | null;
  jobs: PipelineJob[];
  /** true when the server has no Gemini key (scripts, voices and images are simulated) */
  simulated: boolean | null;
  /** a request is in flight */
  busy: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  createJob: (input: CreatePipelineJobInput) => Promise<void>;
  selectJob: (id: string) => Promise<void>;
  runCurrentStep: () => Promise<void>;
  setVisualMode: (mode: 'economic' | 'premium') => Promise<void>;
  publish: () => Promise<{ ok: boolean; message: string; bookId?: string }>;
  newJob: () => void;
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;

const message = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado.');

export const usePipelineStore = create<PipelineState>((set, get) => {
  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  // Polls the job while a step runs on the server.
  function poll(id: string) {
    stopPolling();
    pollTimer = setTimeout(async () => {
      try {
        const job = await pipelineApi.get(id);
        if (get().job?.id !== id) return;
        showJob(job);
        if (job.status === 'running') poll(id);
      } catch (e) {
        set({ error: message(e) });
        poll(id); // transient network errors: keep trying
      }
    }, POLL_MS);
  }

  // Keeps the job picker in sync with the job being shown.
  function showJob(job: PipelineJob) {
    set(s => ({ job, jobs: s.jobs.some(j => j.id === job.id) ? s.jobs.map(j => (j.id === job.id ? job : j)) : [job, ...s.jobs] }));
  }

  function setJob(job: PipelineJob | null) {
    stopPolling();
    storageService.set(JOB_KEY, job?.id ?? null);
    set({ error: null });
    if (job) showJob(job);
    else set({ job: null });
    if (job?.status === 'running') poll(job.id);
  }

  return {
    job: null,
    jobs: [],
    simulated: null,
    busy: false,
    error: null,

    init: async () => {
      set({ busy: true, error: null });
      try {
        const [{ simulated }, jobs] = await Promise.all([pipelineApi.status(), pipelineApi.list()]);
        set({ simulated, jobs });
        const savedId = storageService.get<string | null>(JOB_KEY, null);
        if (savedId && !get().job) {
          const job = jobs.find(j => j.id === savedId) ?? (await pipelineApi.get(savedId).catch(() => null));
          if (job) setJob(job);
        }
      } catch (e) {
        set({ error: message(e) });
      } finally {
        set({ busy: false });
      }
    },

    createJob: async (input) => {
      set({ busy: true, error: null });
      try {
        setJob(await pipelineApi.create(input));
        // Ingest right away: the form is the ingest step.
        await get().runCurrentStep();
      } catch (e) {
        set({ error: message(e) });
      } finally {
        set({ busy: false });
      }
    },

    selectJob: async (id) => {
      set({ busy: true, error: null });
      try {
        setJob(await pipelineApi.get(id));
      } catch (e) {
        set({ error: message(e) });
      } finally {
        set({ busy: false });
      }
    },

    runCurrentStep: async () => {
      const job = get().job;
      if (!job || job.status === 'running') return;
      set({ busy: true, error: null });
      try {
        const started = await pipelineApi.runStep(job.id, job.current_step);
        showJob(started);
        poll(started.id);
      } catch (e) {
        set({ error: message(e) });
      } finally {
        set({ busy: false });
      }
    },

    setVisualMode: async (mode) => {
      const job = get().job;
      if (!job) return;
      set({ job: { ...job, visual_mode: mode } });
      try {
        showJob(await pipelineApi.update(job.id, { visual_mode: mode }));
      } catch (e) {
        set({ job, error: message(e) });
      }
    },

    publish: async () => {
      const job = get().job;
      if (!job) return { ok: false, message: 'No hay ningún trabajo.' };
      set({ busy: true, error: null });
      try {
        const { job: published, bundle } = await pipelineApi.publish(job.id);
        showJob(published);
        await useCatalogStore.getState().addPublished(bundle);
        return { ok: true, message: `"${bundle.book.title}" ya está en el catálogo de Lámina.`, bookId: bundle.book.id };
      } catch (e) {
        set({ error: message(e) });
        return { ok: false, message: message(e) };
      } finally {
        set({ busy: false });
      }
    },

    newJob: () => setJob(null),
  };
});
