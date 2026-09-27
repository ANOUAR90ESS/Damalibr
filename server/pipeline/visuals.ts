import type { Episode } from '../../src/types';
import { AI, mapLimit, models } from './common';
import type { MediaStore } from './media';
import { withRetry } from './voices';

const STYLE = 'cinematic, painterly, dramatic chiaroscuro lighting, historically accurate Spanish setting, rich colour grading, no text, no captions, no watermark';

export async function generateImage(ai: AI, prompt: string, aspectRatio: '9:16' | '16:9' | '3:4'): Promise<Buffer> {
  const response = await ai.models.generateImages({
    model: models.image(),
    prompt: `${prompt}. ${STYLE}`,
    config: { numberOfImages: 1, aspectRatio },
  });
  const bytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!bytes) throw new Error('El modelo de imagen no devolvió ninguna imagen (posible filtro de seguridad).');
  return Buffer.from(bytes, 'base64');
}

/** Generates one background image per scene plus the book cover and backdrop. */
export async function generateVisuals(
  ai: AI,
  media: MediaStore,
  { bookId, title, author, episodes }: { bookId: string; title: string; author: string; episodes: Episode[] },
  onProgress: (done: number, total: number) => void,
): Promise<{ coverUrl: string; backdropUrl: string }> {
  const scenes = episodes.flatMap(ep => ep.script_json.scenes.map(sc => ({ ep, sc })));
  const total = scenes.length + 2;
  let done = 0;

  const coverPrompt = `Book cover artwork for the Spanish classic "${title}" by ${author}, iconic scene, portrait composition`;
  const [cover, backdrop] = await Promise.all([
    withRetry(() => generateImage(ai, coverPrompt, '3:4')),
    withRetry(() => generateImage(ai, `Wide establishing shot evoking "${title}" by ${author}`, '16:9')),
  ]);
  const coverUrl = await media.put(`books/${bookId}/cover.png`, cover, 'image/png');
  const backdropUrl = await media.put(`books/${bookId}/backdrop.png`, backdrop, 'image/png');
  done += 2;
  onProgress(done, total);

  await mapLimit(scenes, 3, async ({ ep, sc }) => {
    if (!sc.image_path) {
      const aspect = ep.format === 'film' ? '16:9' : '9:16';
      const key = `books/${bookId}/images/${ep.id}/${sc.id}.png`;
      sc.image_url = await media.put(key, await withRetry(() => generateImage(ai, sc.visual_prompt, aspect)), 'image/png');
      sc.image_path = key;
    }
    onProgress(++done, total);
  });

  return { coverUrl, backdropUrl };
}
