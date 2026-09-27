import type { GoogleGenAI } from '@google/genai';

export const models = {
  text: () => process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash',
  tts: () => process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview',
  image: () => process.env.GEMINI_IMAGE_MODEL || 'imagen-4.0-generate-001',
};

/** Returns null when no real Gemini key is configured (the pipeline then runs in simulated mode). */
export function hasGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

export type AI = Pick<GoogleGenAI, 'models'>;

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'obra';
}

export const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Rough spoken duration in seconds for a line of Spanish dialogue (~2.5 words/second). */
export function estimateSpeechSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 2.5));
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
