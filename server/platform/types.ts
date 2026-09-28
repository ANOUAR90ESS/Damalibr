export type CreatorProjectType = 'story' | 'book' | 'series' | 'short_film' | 'microdrama' | 'audiobook';

export type ProductionJobType =
  | 'story.generate'
  | 'characters.generate'
  | 'script.generate'
  | 'scenes.generate'
  | 'image.generate'
  | 'voice.generate'
  | 'video.generate'
  | 'subtitle.generate'
  | 'video.render'
  | 'export.create';

export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface CreatorProject {
  id: string;
  ownerId: string;
  title: string;
  type: CreatorProjectType;
  status: 'draft' | 'processing' | 'ready' | 'published' | 'archived';
  description?: string;
  language: string;
  metadata: Record<string, unknown>;
}

export interface ProductionJob<TInput = unknown, TOutput = unknown> {
  id: string;
  projectId: string;
  ownerId: string;
  type: ProductionJobType;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  attempt: number;
  maxAttempts: number;
  input: TInput;
  output?: TOutput;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ExportProfile {
  id: string;
  label: string;
  width: number;
  height: number;
  videoCodec: 'h264' | 'hevc';
  audioCodec: 'aac';
  container: 'mp4';
  maxFps: number;
}

export const EXPORT_PROFILES: ExportProfile[] = [
  { id: 'youtube-1080p', label: 'YouTube 1080p', width: 1920, height: 1080, videoCodec: 'h264', audioCodec: 'aac', container: 'mp4', maxFps: 60 },
  { id: 'vertical-1080p', label: 'Shorts / Reels / TikTok', width: 1080, height: 1920, videoCodec: 'h264', audioCodec: 'aac', container: 'mp4', maxFps: 60 },
  { id: 'square-1080p', label: 'Square 1080p', width: 1080, height: 1080, videoCodec: 'h264', audioCodec: 'aac', container: 'mp4', maxFps: 60 },
];

export interface CreatorExport { id:string; ownerId:string; projectId:string; episodeId?:string; jobId:string; profileId:string; storageKey:string; status:'queued'|'processing'|'ready'|'failed'; createdAt:string; metadata:Record<string,unknown>; }
