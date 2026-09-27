import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { LocalMediaStore } from './media';
import { MemoryJobStore } from './jobs';
import { PipelineService, type PipelineDeps } from './service';
import { RUNNABLE_STEPS } from './service';
import type { AI } from './common';

const hasFfmpeg = (() => {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
})();

const TEXT = `ACTO PRIMERO
MADRE: Hijo, el almuerzo está listo en la mesa desde hace rato.
NOVIO: Déjalo, comeré uvas por el camino hacia la viña.

ACTO SEGUNDO
NOVIA: No quiero hablar de eso ahora, déjame tranquila un momento.
LEONARDO: ¿Quién ha dicho que yo venga a hablar contigo esta noche?`;

let dir: string;
let png: Buffer;

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'lamina-pipeline-test-'));
  if (hasFfmpeg) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=360x640', '-frames:v', '1', path.join(dir, 'img.png')]);
    png = readFileSync(path.join(dir, 'img.png'));
  }
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function makeService(ai: AI | null) {
  const deps: PipelineDeps = { store: new MemoryJobStore(), media: new LocalMediaStore(path.join(dir, 'media')), ai, supabaseAdmin: null };
  return { service: new PipelineService(deps), deps };
}

async function runAll(service: PipelineService, jobId: string) {
  for (const step of RUNNABLE_STEPS) {
    const job = await service.getJob(jobId);
    await service.execute(job, step);
    const after = await service.getJob(jobId);
    if (after.status === 'failed') throw new Error(after.logs.at(-1)?.message);
  }
}

/** Fake Gemini: JSON for text prompts, 1 s of PCM for TTS, a PNG for images. */
function fakeAI(): AI & { calls: Record<string, number> } {
  const calls = { text: 0, tts: 0, image: 0 };
  return {
    calls,
    models: {
      generateContent: async (params: any) => {
        if (params.config?.responseModalities?.includes('AUDIO')) {
          calls.tts++;
          return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(48_000).toString('base64') } }] } }] };
        }
        calls.text++;
        const props = params.config.responseSchema.properties;
        if (props.book) {
          return { text: JSON.stringify({
            book: { synopsis: 'Tragedia rural.', genres: ['Tragedia'], era: 'Vanguardias', year: 1933, kids_friendly: false },
            characters: [
              { name: 'Madre', description: 'd', role: 'protagonista', personality: 'p', gender: 'femenino', age_range: '60' },
              { name: 'Leonardo', description: 'd', role: 'antagonista', personality: 'p', gender: 'masculino', age_range: '30' },
            ],
          }) };
        }
        return { text: JSON.stringify({ episodes: [{ title: 'La navaja', cliffhanger: '¿Y ahora?', scenes: [
          { setting: 'Cocina', visual_prompt: 'kitchen', lines: [{ character_name: 'Madre', text: 'La navaja.', emotion: 'furioso' }, { character_name: 'Leonardo', text: 'Me voy.', emotion: 'tenso' }] },
        ] }] }) };
      },
      generateImages: async () => { calls.image++; return { generatedImages: [{ image: { imageBytes: png.toString('base64') } }] }; },
    } as any,
  };
}

describe('PipelineService', () => {
  it('enforces step order and blocks publishing before review', async () => {
    const { service } = makeService(null);
    const job = await service.createJob({ title: 'Bodas de sangre', author: 'Lorca', source_type: 'custom_text', raw_text: TEXT }, null);
    expect(job.book_id).toBe('book-bodas-de-sangre');
    await expect(service.startStep(job.id, 'adapt')).rejects.toThrow(/siguiente paso/);
    await expect(service.startStep(job.id, 'review' as any)).rejects.toThrow(/desconocido/);
    await expect(service.publish(job.id)).rejects.toThrow(/antes de publicar/);
    await expect(service.getJob('nope')).rejects.toThrow(/no encontrado/);
  });

  it('records failures and lets the step be retried', async () => {
    const { service } = makeService(null);
    const job = await service.createJob({ title: 'X', author: 'Y', source_type: 'custom_text', raw_text: '   ' }, null);
    await service.execute(await service.getJob(job.id), 'ingest');
    const failed = await service.getJob(job.id);
    expect(failed).toMatchObject({ status: 'failed', current_step: 'ingest' });
    expect(failed.logs.at(-1)).toMatchObject({ type: 'error' });
  });

  it.skipIf(!hasFfmpeg)('runs every step in simulated mode and publishes a playable book', async () => {
    const { service } = makeService(null);
    const job = await service.createJob({ title: 'Bodas de sangre', author: 'Lorca', source_type: 'custom_text', raw_text: TEXT, drama_episodes: 2 }, null);
    await runAll(service, job.id);

    const done = await service.getJob(job.id);
    expect(done).toMatchObject({ current_step: 'review', status: 'waiting_review', progress: 95 });
    expect(done.chapters?.map(c => c.title)).toEqual(['ACTO PRIMERO', 'ACTO SEGUNDO']);
    const eps = Object.values(done.episodes!).flat();
    expect(eps).toHaveLength(4);
    for (const ep of eps) {
      expect(ep.hls_url).toMatch(/^\/media\/books\/book-bodas-de-sangre\/video\/.+\/index\.m3u8$/);
      expect(existsSync(path.join(dir, ep.video_url.replace(/^\/media/, 'media')))).toBe(true);
    }

    const { job: published, bundle } = await service.publish(job.id);
    expect(published).toMatchObject({ current_step: 'published', status: 'completed', progress: 100 });
    expect(bundle.book).toMatchObject({ id: 'book-bodas-de-sangre', status: 'ready' });
    expect(bundle.adaptations.every(a => a.status === 'ready')).toBe(true);
  }, 120_000);

  it.skipIf(!hasFfmpeg)('uses Gemini for scripts, voices and images when a key is configured', async () => {
    const ai = fakeAI();
    const { service } = makeService(ai);
    const job = await service.createJob({ title: 'Bodas', author: 'Lorca', source_type: 'custom_text', raw_text: TEXT, drama_episodes: 1 }, null);
    await runAll(service, job.id);

    const done = await service.getJob(job.id);
    expect(done.book).toMatchObject({ year: 1933, era: 'Vanguardias', cover_url: '/media/books/book-bodas/cover.png' });
    const ep = done.episodes!['adapt-bodas-drama'][0];
    const line = ep.script_json.scenes[0].lines[0];
    expect(line).toMatchObject({ audio_path: `books/book-bodas/audio/${ep.id}/l-1-1-1.wav`, duration_seconds: 1 });
    expect(ep.script_json.scenes[0].image_path).toBe(`books/book-bodas/images/${ep.id}/scene-1-1.png`);
    // 3 formats x 2 lines of TTS, 3 scenes + cover + backdrop images
    expect(ai.calls).toEqual({ text: 4, tts: 6, image: 5 });

    // Published rows do not leak storage paths
    const { bundle } = await service.publish(job.id);
    const pubLine = bundle.episodes['adapt-bodas-drama'][0].script_json.scenes[0];
    expect(pubLine).not.toHaveProperty('image_path');
    expect(pubLine.lines[0]).not.toHaveProperty('audio_path');
    expect(pubLine.lines[0].audio_url).toMatch(/\.wav$/);
  }, 120_000);
});
