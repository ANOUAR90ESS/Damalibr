import type { Character, Episode } from '../../src/types';
import { AI, mapLimit, models } from './common';
import { pcmSeconds, pcmToWav, rateFromMime } from './audio';
import type { MediaStore } from './media';
import { NARRATOR_VOICE } from './analyze';

const EMOTION_STYLE: Record<string, string> = {
  tenso: 'con tensión contenida',
  apasionado: 'con pasión',
  furioso: 'con furia',
  'melancólico': 'con melancolía',
  'sarcástico': 'con sarcasmo',
  misterioso: 'en tono misterioso',
  neutro: 'con naturalidad',
};

export async function synthesizeLine(ai: AI, text: string, voice: string, emotion: string): Promise<{ pcm: Buffer; sampleRate: number }> {
  const response = await ai.models.generateContent({
    model: models.tts(),
    contents: [{ parts: [{ text: `Lee en español de España, ${EMOTION_STYLE[emotion] || EMOTION_STYLE.neutro}: ${text}` }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error('El modelo de voz no devolvió audio.');
  return { pcm: Buffer.from(part.inlineData.data, 'base64'), sampleRate: rateFromMime(part.inlineData.mimeType) };
}

/**
 * Generates one WAV per dialogue line with the character's voice and stores it.
 * Line, scene and episode durations are updated to the real audio length.
 */
export async function generateVoices(
  ai: AI,
  media: MediaStore,
  { bookId, characters, episodes }: { bookId: string; characters: Character[]; episodes: Episode[] },
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const voiceOf = new Map(characters.map(c => [c.id, c.voice_id]));
  const jobs = episodes.flatMap(ep => ep.script_json.scenes.flatMap(sc => sc.lines.map(line => ({ ep, line }))));
  let done = 0;

  await mapLimit(jobs, 4, async ({ ep, line }) => {
    if (!line.audio_path) {
      const { pcm, sampleRate } = await withRetry(() => synthesizeLine(ai, line.text, voiceOf.get(line.character_id) || NARRATOR_VOICE, line.emotion));
      const key = `books/${bookId}/audio/${ep.id}/${line.id}.wav`;
      line.audio_url = await media.put(key, pcmToWav(pcm, sampleRate), 'audio/wav');
      line.audio_path = key;
      line.duration_seconds = Math.round(pcmSeconds(pcm, sampleRate) * 10) / 10;
    }
    onProgress(++done, jobs.length);
  });

  recomputeDurations(episodes);
}

/** Pause inserted between consecutive lines when rendering. */
export const LINE_GAP_SECONDS = 0.35;

export function recomputeDurations(episodes: Episode[]) {
  for (const ep of episodes) {
    for (const sc of ep.script_json.scenes) {
      const speech = sc.lines.reduce((t, l) => t + l.duration_seconds, 0);
      sc.duration = Math.max(3, Math.round((speech + LINE_GAP_SECONDS * sc.lines.length) * 10) / 10);
    }
    ep.duration = Math.round(ep.script_json.scenes.reduce((t, sc) => t + sc.duration, 0));
  }
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastError;
}
