import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book, PipelineStep } from '../../src/types';
import { AI, slugify } from './common';
import { cleanSourceText, fetchSourceText, segmentChapters } from './ingest';
import { analyzeBook } from './analyze';
import { generateAdaptations } from './adapt';
import { generateVoices, recomputeDurations } from './voices';
import { generateVisuals } from './visuals';
import { isFfmpegAvailable, renderEpisode } from './render';
import { CatalogBundle, publishToSupabase, toPublishedBundle } from './publish';
import type { JobStore, StoredJob } from './jobs';
import type { MediaStore } from './media';

export interface PipelineDeps {
  store: JobStore;
  media: MediaStore;
  /** null = simulated mode (no Gemini key): deterministic scripts, silent audio, no images */
  ai: AI | null;
  supabaseAdmin: SupabaseClient | null;
  fetchImpl?: typeof fetch;
  ffmpeg?: string;
}

export interface CreateJobInput {
  title: string;
  author: string;
  source_type: StoredJob['source_type'];
  source_url?: string;
  raw_text?: string;
  visual_mode?: 'economic' | 'premium';
  drama_episodes?: number;
}

export class PipelineError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const RUNNABLE_STEPS: PipelineStep[] = ['ingest', 'analyze', 'adapt', 'voices', 'visuals', 'render'];
const NEXT: Partial<Record<PipelineStep, PipelineStep>> = {
  ingest: 'analyze', analyze: 'adapt', adapt: 'voices', voices: 'visuals', visuals: 'render', render: 'review',
};
const PROGRESS: Record<string, [number, number]> = {
  ingest: [0, 10], analyze: [10, 20], adapt: [20, 35], voices: [35, 55], visuals: [55, 75], render: [75, 95],
};
const PLACEHOLDER_COVER = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80';

interface StepContext {
  job: StoredJob;
  log: (message: string, type?: 'info' | 'success' | 'warn' | 'error') => Promise<void>;
  progress: (fraction: number) => void;
}

export class PipelineService {
  private running = new Set<string>();

  constructor(private deps: PipelineDeps) {}

  get simulated() {
    return !this.deps.ai;
  }

  async createJob(input: CreateJobInput, userId: string | null): Promise<StoredJob> {
    const now = new Date().toISOString();
    const job: StoredJob = {
      id: `job-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      created_by: userId,
      book_title: input.title,
      author: input.author,
      book_id: `book-${slugify(input.title)}`,
      source_type: input.source_type,
      source_url: input.source_url,
      raw_text: input.raw_text,
      current_step: 'ingest',
      status: 'idle',
      progress: 0,
      logs: [{ timestamp: now, message: `Trabajo creado para "${input.title}" de ${input.author}.`, type: 'info' }],
      visual_mode: input.visual_mode || 'economic',
      drama_episodes: input.drama_episodes,
      render_options: { quality: ['720p'], subtitles_burned: true },
      created_at: now,
      updated_at: now,
    };
    await this.deps.store.create(job);
    return job;
  }

  async getJob(id: string): Promise<StoredJob> {
    const job = await this.deps.store.get(id);
    if (!job) throw new PipelineError('Trabajo no encontrado.', 404);
    // A job marked running that this process is not running was interrupted (e.g. restart).
    if (job.status === 'running' && !this.running.has(id)) job.status = 'failed';
    return job;
  }

  listJobs(limit = 20) {
    return this.deps.store.list(limit);
  }

  async updateJob(id: string, patch: { visual_mode?: 'economic' | 'premium'; drama_episodes?: number }): Promise<StoredJob> {
    const job = await this.getJob(id);
    if (this.running.has(id)) throw new PipelineError('El trabajo se está ejecutando.', 409);
    if (patch.visual_mode) job.visual_mode = patch.visual_mode;
    if (patch.drama_episodes) job.drama_episodes = patch.drama_episodes;
    job.updated_at = new Date().toISOString();
    await this.deps.store.save(job);
    return job;
  }

  /** Starts `step` in the background and returns immediately; poll getJob() for progress. */
  async startStep(id: string, step: PipelineStep): Promise<StoredJob> {
    if (!RUNNABLE_STEPS.includes(step)) throw new PipelineError('Paso desconocido.');
    const job = await this.getJob(id);
    if (this.running.has(id)) throw new PipelineError('El trabajo ya se está ejecutando.', 409);
    if (job.current_step !== step) {
      throw new PipelineError(`El siguiente paso de este trabajo es "${job.current_step}", no "${step}".`, 409);
    }

    job.status = 'running';
    job.progress = PROGRESS[step][0];
    this.running.add(id);
    await this.deps.store.save(job);
    void this.execute(job, step);
    return job;
  }

  /** Runs a step to completion (used by startStep, and directly by tests). */
  async execute(job: StoredJob, step: PipelineStep): Promise<void> {
    this.running.add(job.id);
    let lastSave = 0;
    const save = async (force = false) => {
      if (!force && Date.now() - lastSave < 1000) return;
      lastSave = Date.now();
      job.updated_at = new Date().toISOString();
      await this.deps.store.save(job);
    };
    const ctx: StepContext = {
      job,
      log: async (message, type = 'info') => {
        job.logs.push({ timestamp: new Date().toISOString(), message, type });
        await save(true);
      },
      progress: fraction => {
        const [from, to] = PROGRESS[step];
        job.progress = Math.round(from + (to - from) * Math.min(1, Math.max(0, fraction)));
        void save().catch(() => {});
      },
    };

    try {
      await this.steps[step as keyof PipelineService['steps']](ctx);
      job.current_step = NEXT[step]!;
      job.progress = PROGRESS[step][1];
      job.status = job.current_step === 'review' ? 'waiting_review' : 'idle';
      await ctx.log(`Paso "${step}" completado.`, 'success');
    } catch (e) {
      job.status = 'failed';
      await ctx.log(`Error en el paso "${step}": ${e instanceof Error ? e.message : String(e)}`, 'error').catch(() => {});
    } finally {
      this.running.delete(job.id);
      await save(true).catch(e => console.error('No se pudo guardar el trabajo', e));
    }
  }

  private steps = {
    ingest: async ({ job, log, progress }: StepContext) => {
      let text: string;
      if (job.source_type === 'custom_text') {
        if (!job.raw_text?.trim()) throw new Error('No hay texto que procesar.');
        text = job.raw_text;
      } else {
        if (!job.source_url) throw new Error('Falta la URL de origen.');
        await log(`Descargando ${job.source_url}…`);
        text = await fetchSourceText(job.source_url, this.deps.fetchImpl);
      }
      progress(0.5);
      const chapters = segmentChapters(cleanSourceText(text));
      if (!chapters.length) throw new Error('El texto está vacío tras la limpieza.');
      await this.deps.store.saveChapters(job.id, chapters);
      job.chapters = chapters.map(c => ({ title: c.title, length: c.text.length }));
      job.raw_text = job.source_type === 'custom_text' ? job.raw_text : text.slice(0, 2000);
      const words = chapters.reduce((t, c) => t + c.text.split(/\s+/).length, 0);
      await log(`Texto limpio: ${chapters.length} capítulos/segmentos, ${words.toLocaleString('es-ES')} palabras.`, 'success');
    },

    analyze: async ({ job, log }: StepContext) => {
      const chapters = await this.deps.store.getChapters(job.id);
      if (this.simulated) await log('Sin GEMINI_API_KEY: análisis simulado a partir del texto.', 'warn');
      const { characters, meta } = await analyzeBook(this.deps.ai, { bookId: job.book_id!, title: job.book_title, author: job.author, chapters });
      job.characters = characters;
      const book: Book = {
        id: job.book_id!,
        title: job.book_title,
        author: job.author,
        year: meta.year ?? 1900,
        language: 'es',
        cover_url: job.book?.cover_url || PLACEHOLDER_COVER,
        backdrop_url: job.book?.backdrop_url || PLACEHOLDER_COVER,
        synopsis: meta.synopsis,
        source_text_url: job.source_url || '',
        genres: meta.genres,
        era: meta.era,
        status: 'draft',
        rating: 0,
        total_views: 0,
        featured: false,
        kids_friendly: meta.kids_friendly,
      };
      job.book = book;
      if (meta.year === null) await log('Año de publicación desconocido; se usará 1900.', 'warn');
      await log(`${characters.length} personajes: ${characters.map(c => `${c.name} (${c.voice_name})`).join(', ')}.`, 'success');
    },

    adapt: async ({ job, log }: StepContext) => {
      const chapters = await this.deps.store.getChapters(job.id);
      if (!job.characters?.length || !job.book) throw new Error('Ejecuta primero el análisis.');
      if (this.simulated) await log('Sin GEMINI_API_KEY: guiones simulados con frases del propio texto.', 'warn');
      const result = await generateAdaptations(this.deps.ai, {
        bookId: job.book.id,
        title: job.book_title,
        author: job.author,
        coverUrl: job.book.cover_url,
        characters: job.characters,
        chapters,
        visualMode: job.visual_mode || 'economic',
        dramaEpisodes: job.drama_episodes,
      });
      job.characters = result.characters;
      job.adaptations = result.adaptations;
      job.episodes = result.episodes;
      for (const a of result.adaptations) {
        await log(`${a.format}: ${a.episode_count} episodio(s), ~${Math.round(a.total_duration / 60)} min.`, 'success');
      }
    },

    voices: async ({ job, log, progress }: StepContext) => {
      const episodes = Object.values(job.episodes || {}).flat();
      if (!episodes.length) throw new Error('Ejecuta primero la adaptación.');
      if (this.simulated) {
        await log('Sin GEMINI_API_KEY: no se genera audio; el render usará silencio con subtítulos.', 'warn');
        recomputeDurations(episodes);
      } else {
        const total = episodes.reduce((t, e) => t + e.script_json.scenes.reduce((s, sc) => s + sc.lines.length, 0), 0);
        await log(`Generando ${total} líneas de voz…`);
        await generateVoices(this.deps.ai!, this.deps.media, { bookId: job.book_id!, characters: job.characters || [], episodes }, (d, t) => progress(d / t));
        await log('Audio de todas las líneas generado.', 'success');
      }
      this.updateTotals(job);
    },

    visuals: async ({ job, log, progress }: StepContext) => {
      const episodes = Object.values(job.episodes || {}).flat();
      if (!episodes.length) throw new Error('Ejecuta primero la adaptación.');
      if (job.visual_mode === 'premium') await log('El modo premium (vídeo con Veo) aún no está disponible; se usa el modo económico.', 'warn');
      if (this.simulated) {
        await log('Sin GEMINI_API_KEY: no se generan imágenes; el render usará fondos lisos.', 'warn');
        return;
      }
      const scenes = episodes.reduce((t, e) => t + e.script_json.scenes.length, 0);
      await log(`Generando portada y ${scenes} imágenes de escena…`);
      const { coverUrl, backdropUrl } = await generateVisuals(this.deps.ai!, this.deps.media, {
        bookId: job.book_id!, title: job.book_title, author: job.author, episodes,
      }, (d, t) => progress(d / t));
      job.book = { ...job.book!, cover_url: coverUrl, backdrop_url: backdropUrl };
      await log('Imágenes generadas.', 'success');
    },

    render: async ({ job, log, progress }: StepContext) => {
      const episodes = Object.values(job.episodes || {}).flat();
      if (!episodes.length) throw new Error('Ejecuta primero la adaptación.');
      if (!(await isFfmpegAvailable(this.deps.ffmpeg))) {
        throw new Error('FFmpeg no está instalado en el servidor (o define FFMPEG_PATH).');
      }
      for (const [i, ep] of episodes.entries()) {
        await log(`Renderizando ${ep.format} ${ep.number}/${episodes.filter(e => e.format === ep.format).length}: "${ep.title}"…`);
        const out = await renderEpisode(this.deps.media, job.book_id!, ep, this.deps.ffmpeg);
        Object.assign(ep, out);
        progress((i + 1) / episodes.length);
      }
      this.updateTotals(job);
      await log('Vídeos MP4 y HLS listos para revisión.', 'success');
    },
  };

  private updateTotals(job: StoredJob) {
    for (const a of job.adaptations || []) {
      a.total_duration = (job.episodes?.[a.id] || []).reduce((t, e) => t + e.duration, 0);
    }
  }

  /** Human review approved: writes the book to the catalog. */
  async publish(id: string): Promise<{ job: StoredJob; bundle: CatalogBundle }> {
    const job = await this.getJob(id);
    if (this.running.has(id)) throw new PipelineError('El trabajo se está ejecutando.', 409);
    if (job.current_step !== 'review' && job.current_step !== 'published') {
      throw new PipelineError('Completa todos los pasos (hasta el render) antes de publicar.', 409);
    }
    if (!job.book || !job.adaptations?.length || !job.episodes) throw new PipelineError('El trabajo no tiene contenido que publicar.', 409);

    const bundle: CatalogBundle = { book: job.book, characters: job.characters || [], adaptations: job.adaptations, episodes: job.episodes };
    if (this.deps.supabaseAdmin) await publishToSupabase(this.deps.supabaseAdmin, bundle);

    job.current_step = 'published';
    job.status = 'completed';
    job.progress = 100;
    job.logs.push({
      timestamp: new Date().toISOString(),
      message: this.deps.supabaseAdmin ? 'Publicado en el catálogo.' : 'Publicado en el catálogo local (sin Supabase).',
      type: 'success',
    });
    job.updated_at = new Date().toISOString();
    await this.deps.store.save(job);
    return { job, bundle: toPublishedBundle(bundle) };
  }
}
