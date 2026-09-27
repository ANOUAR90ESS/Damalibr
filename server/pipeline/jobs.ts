import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineJob } from '../../src/types';
import type { Chapter } from './ingest';

/** Server-side job: the public PipelineJob plus the book being built. */
export interface StoredJob extends PipelineJob {
  created_by: string | null;
}

export interface JobStore {
  create(job: StoredJob): Promise<void>;
  get(id: string): Promise<StoredJob | null>;
  save(job: StoredJob): Promise<void>;
  list(limit: number): Promise<StoredJob[]>;
  /** The full source text is stored apart from the job to keep job saves small. */
  saveChapters(id: string, chapters: Chapter[]): Promise<void>;
  getChapters(id: string): Promise<Chapter[]>;
}

/** In-memory store for local development without Supabase. */
export class MemoryJobStore implements JobStore {
  private jobs = new Map<string, StoredJob>();
  private chapters = new Map<string, Chapter[]>();

  async create(job: StoredJob) { this.jobs.set(job.id, structuredClone(job)); }
  async get(id: string) { const j = this.jobs.get(id); return j ? structuredClone(j) : null; }
  async save(job: StoredJob) { this.jobs.set(job.id, structuredClone(job)); }
  async list(limit: number) {
    return [...this.jobs.values()]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, limit)
      .map(j => structuredClone(j));
  }
  async saveChapters(id: string, chapters: Chapter[]) { this.chapters.set(id, chapters); }
  async getChapters(id: string) { return this.chapters.get(id) || []; }
}

/** Persists jobs in public.pipeline_jobs through the service role. */
export class SupabaseJobStore implements JobStore {
  constructor(private admin: SupabaseClient) {}

  async create(job: StoredJob) {
    const { error } = await this.admin.from('pipeline_jobs').insert({ id: job.id, created_by: job.created_by, data: job });
    if (error) throw error;
  }

  async get(id: string) {
    const { data, error } = await this.admin.from('pipeline_jobs').select('data').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data?.data as StoredJob) ?? null;
  }

  async save(job: StoredJob) {
    const { error } = await this.admin.from('pipeline_jobs').update({ data: job, updated_at: new Date().toISOString() }).eq('id', job.id);
    if (error) throw error;
  }

  async list(limit: number) {
    const { data, error } = await this.admin.from('pipeline_jobs').select('data').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(r => r.data as StoredJob);
  }

  async saveChapters(id: string, chapters: Chapter[]) {
    const { error } = await this.admin.from('pipeline_jobs').update({ source_chapters: chapters }).eq('id', id);
    if (error) throw error;
  }

  async getChapters(id: string) {
    const { data, error } = await this.admin.from('pipeline_jobs').select('source_chapters').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data?.source_chapters as Chapter[]) || [];
  }
}
