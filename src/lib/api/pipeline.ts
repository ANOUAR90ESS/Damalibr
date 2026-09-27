import type { PipelineJob, PipelineStep } from '../../types';
import type { Catalog } from './catalog';
import type { Adaptation, Book, Character, Episode } from '../../types';
import { apiRequest } from './http';

export interface CreatePipelineJobInput {
  title: string;
  author: string;
  source_type: PipelineJob['source_type'];
  source_url?: string;
  raw_text?: string;
  visual_mode?: 'economic' | 'premium';
  drama_episodes?: number;
}

export interface PublishedBundle {
  book: Book;
  characters: Character[];
  adaptations: Adaptation[];
  episodes: Catalog['episodesByAdaptation'];
}

export const pipelineApi = {
  status: () => apiRequest<{ simulated: boolean }>('/api/pipeline/status'),
  list: () => apiRequest<{ jobs: PipelineJob[] }>('/api/pipeline/jobs').then(r => r.jobs),
  get: (id: string) => apiRequest<{ job: PipelineJob }>(`/api/pipeline/jobs/${encodeURIComponent(id)}`).then(r => r.job),
  create: (input: CreatePipelineJobInput) =>
    apiRequest<{ job: PipelineJob }>('/api/pipeline/jobs', { method: 'POST', body: input }).then(r => r.job),
  update: (id: string, patch: { visual_mode?: 'economic' | 'premium'; drama_episodes?: number }) =>
    apiRequest<{ job: PipelineJob }>(`/api/pipeline/jobs/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }).then(r => r.job),
  runStep: (id: string, step: PipelineStep) =>
    apiRequest<{ job: PipelineJob }>(`/api/pipeline/jobs/${encodeURIComponent(id)}/steps/${step}`, { method: 'POST' }).then(r => r.job),
  publish: (id: string) =>
    apiRequest<{ job: PipelineJob; bundle: PublishedBundle }>(`/api/pipeline/jobs/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
};
