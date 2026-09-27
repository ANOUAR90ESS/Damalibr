import { Type } from '@google/genai';
import type { Adaptation, BookFormat, Character, Episode, ScriptLine, ScriptScene } from '../../src/types';
import { AI, estimateSpeechSeconds, mapLimit, models, round4 } from './common';
import { narratorFor, sampleText } from './analyze';
import type { Chapter } from './ingest';

export interface AdaptInput {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  characters: Character[];
  chapters: Chapter[];
  visualMode: 'economic' | 'premium';
  /** Number of vertical microdrama episodes (default 12, max 40) */
  dramaEpisodes?: number;
}

export interface AdaptResult {
  adaptations: Adaptation[];
  episodes: Record<string, Episode[]>;
  /** The narrator is added to the cast when the summary/film needs it */
  characters: Character[];
}

interface RawLine { character_name?: string; text?: string; emotion?: string }
interface RawScene { setting?: string; visual_prompt?: string; lines?: RawLine[] }
interface RawEpisode { title?: string; cliffhanger?: string; scenes?: RawScene[] }

const EMOTIONS = ['tenso', 'apasionado', 'furioso', 'melancólico', 'sarcástico', 'misterioso', 'neutro'];
const FREE_DRAMA_EPISODES = 5;
const DRAMA_PRICE = 10;
const FILM_PRICE = 25;

const FORMAT_BRIEF: Record<BookFormat, (n: number) => string> = {
  drama: n => `un MICRODRAMA VERTICAL 9:16 de exactamente ${n} episodios de 1 a 3 minutos. Cada episodio: 2-3 escenas con diálogo real y tenso entre personajes (6-12 líneas en total) y un cliffhanger final que obligue a ver el siguiente. Los episodios deben cubrir la obra completa en orden, del principio al final.`,
  film: () => 'un CORTOMETRAJE CINEMATOGRÁFICO 16:9 de 10 a 20 minutos en un único episodio con 8-12 escenas que condensen el arco completo de la obra.',
  summary: () => 'un VIDEO-RESUMEN 9:16 de 5 a 10 minutos en un único episodio con 5-8 escenas, narrado íntegramente por "Narrador", que explique la trama, los personajes y el sentido de la obra.',
};

const scriptSchema = {
  type: Type.OBJECT,
  properties: {
    episodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          cliffhanger: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                setting: { type: Type.STRING },
                visual_prompt: { type: Type.STRING },
                lines: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      character_name: { type: Type.STRING },
                      text: { type: Type.STRING },
                      emotion: { type: Type.STRING, enum: EMOTIONS },
                    },
                    required: ['character_name', 'text', 'emotion'],
                  },
                },
              },
              required: ['setting', 'visual_prompt', 'lines'],
            },
          },
        },
        required: ['title', 'cliffhanger', 'scenes'],
      },
    },
  },
  required: ['episodes'],
};

async function writeScripts(ai: AI, input: AdaptInput, format: BookFormat, count: number): Promise<RawEpisode[]> {
  const cast = input.characters.map(c => `- ${c.name} (${c.role}, ${c.gender}): ${c.personality || c.description}`).join('\n');
  const response = await ai.models.generateContent({
    model: models.text(),
    contents: `Adapta "${input.title}" de ${input.author} como ${FORMAT_BRIEF[format](count)}
Usa SOLO estos personajes (character_name exacto) y "Narrador" si hace falta:
${cast}

"visual_prompt" describe en inglés una imagen cinematográfica de la escena (${format === 'film' ? '16:9 horizontal' : '9:16 vertical'}), sin texto.

Fragmentos de la obra en orden:
${sampleText(input.chapters, 40_000)}`,
    config: {
      systemInstruction: 'Eres un guionista experto en adaptar clásicos españoles en dominio público. Escribes en español, con diálogos breves, intensos y fieles al original.',
      responseMimeType: 'application/json',
      responseSchema: scriptSchema,
    },
  });
  const parsed = JSON.parse(response.text || '{}');
  return Array.isArray(parsed.episodes) ? parsed.episodes : [];
}

interface Utterance { speaker: string | null; text: string }

// Splits a chapter into utterances: "NAME: text" lines keep their speaker, narrative
// prose becomes sentences without one.
export function utterances(text: string): Utterance[] {
  const out: Utterance[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const dialogue = line.match(/^([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ .]{1,30}):\s*(.+)$/);
    if (dialogue) {
      out.push({ speaker: dialogue[1].trim(), text: dialogue[2].trim() });
      continue;
    }
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      if (sentence.length > 20 && sentence.length < 240) out.push({ speaker: null, text: sentence });
    }
  }
  return out;
}

// Deterministic scripts built from the text itself, used without a Gemini key.
function simulatedScripts(input: AdaptInput, format: BookFormat, count: number): RawEpisode[] {
  const cast = input.characters.filter(c => c.role !== 'narrador');
  const castName = (speaker: string | null, i: number) => {
    if (format === 'summary') return 'Narrador';
    const match = speaker && cast.find(c => c.name.toLowerCase() === speaker.toLowerCase());
    return match ? match.name : speaker ? 'Narrador' : cast[i % Math.max(1, cast.length)]?.name || 'Narrador';
  };

  return Array.from({ length: count }, (_, i) => {
    const chapter = input.chapters[Math.floor((i * input.chapters.length) / count)] || { title: input.title, text: input.title };
    const pool = utterances(chapter.text);
    const scenes: RawScene[] = [0, 1].map(s => {
      const slice = pool.slice(s * 3, s * 3 + 3);
      return {
        setting: `${chapter.title} — escena ${s + 1}`,
        visual_prompt: `Cinematic illustration of a scene from the Spanish classic "${input.title}", ${chapter.title}`,
        lines: (slice.length ? slice : [{ speaker: null, text: `${input.title}: ${chapter.title}.` }]).map((u, l) => ({
          character_name: castName(u.speaker, s * 3 + l),
          text: u.text,
          emotion: EMOTIONS[(i + l) % EMOTIONS.length],
        })),
      };
    });
    return { title: chapter.title, cliffhanger: pool[pool.length - 1]?.text || '¿Qué ocurrirá después?', scenes };
  });
}

export function buildEpisodes(
  input: AdaptInput,
  adaptation: Adaptation,
  raw: RawEpisode[],
  resolveCharacter: (name: string) => Character,
): Episode[] {
  const format = adaptation.format;
  const n = raw.length;
  return raw.map((ep, i) => {
    const number = i + 1;
    const scenes: ScriptScene[] = (ep.scenes || []).map((sc, s) => {
      const lines: ScriptLine[] = (sc.lines || [])
        .filter(l => l.text && l.text.trim())
        .map((l, j) => {
          const character = resolveCharacter(l.character_name || 'Narrador');
          const text = l.text!.trim();
          return {
            id: `l-${number}-${s + 1}-${j + 1}`,
            character_id: character.id,
            character_name: character.name,
            text,
            emotion: EMOTIONS.includes(l.emotion || '') ? l.emotion! : 'neutro',
            duration_seconds: estimateSpeechSeconds(text),
          };
        });
      return {
        id: `scene-${number}-${s + 1}`,
        setting: (sc.setting || '').trim(),
        visual_prompt: (sc.visual_prompt || sc.setting || input.title).trim(),
        visual_mode: input.visualMode,
        image_url: input.coverUrl,
        lines,
        duration: Math.max(3, lines.reduce((t, l) => t + l.duration_seconds, 0)),
      };
    }).filter(sc => sc.lines.length > 0);

    const duration = scenes.reduce((t, sc) => t + sc.duration, 0);
    const isFree = format === 'summary' || (format === 'drama' && number <= FREE_DRAMA_EPISODES);
    return {
      id: `ep-${adaptation.id.replace(/^adapt-/, '')}-${number}`,
      adaptation_id: adaptation.id,
      book_id: input.bookId,
      number,
      title: (ep.title || `Episodio ${number}`).trim(),
      format,
      script_json: { adaptation_id: adaptation.id, episode_number: number, cliffhanger_text: ep.cliffhanger?.trim(), scenes },
      video_url: '',
      thumbnail_url: input.coverUrl,
      duration,
      is_free: isFree,
      coin_price: isFree ? 0 : format === 'film' ? FILM_PRICE : DRAMA_PRICE,
      story_position_start: round4(i / n),
      story_position_end: round4((i + 1) / n),
      cliffhanger: (ep.cliffhanger || '').trim(),
    };
  }).filter(ep => ep.script_json.scenes.length > 0);
}

export async function generateAdaptations(ai: AI | null, input: AdaptInput): Promise<AdaptResult> {
  const slug = input.bookId.replace(/^book-/, '');
  const dramaCount = Math.min(40, Math.max(1, input.dramaEpisodes ?? 12));
  const plan: Array<{ format: BookFormat; count: number; description: string }> = [
    { format: 'drama', count: dramaCount, description: `Microdrama vertical 9:16 en ${dramaCount} episodios con cliffhangers.` },
    { format: 'film', count: 1, description: 'Cortometraje cinematográfico 16:9 que condensa la obra completa.' },
    { format: 'summary', count: 1, description: 'Video-resumen 9:16 guiado por narrador.' },
  ];

  const characters = [...input.characters];
  const byName = new Map(characters.map(c => [c.name.toLowerCase(), c]));
  const resolveCharacter = (name: string) => {
    const found = byName.get(name.trim().toLowerCase());
    if (found) return found;
    let narrator = byName.get('narrador');
    if (!narrator) {
      narrator = narratorFor(input.bookId);
      characters.push(narrator);
      byName.set('narrador', narrator);
    }
    return narrator;
  };

  const scripts = await mapLimit(plan, 3, p => (ai ? writeScripts(ai, input, p.format, p.count) : Promise.resolve(simulatedScripts(input, p.format, p.count))));

  const adaptations: Adaptation[] = [];
  const episodes: Record<string, Episode[]> = {};
  plan.forEach((p, i) => {
    const adaptation: Adaptation = {
      id: `adapt-${slug}-${p.format}`,
      book_id: input.bookId,
      format: p.format,
      status: 'draft',
      total_duration: 0,
      episode_count: 0,
      description: p.description,
      aspect_ratio: p.format === 'film' ? '16:9' : '9:16',
    };
    const eps = buildEpisodes(input, adaptation, scripts[i], resolveCharacter);
    if (!eps.length) return;
    adaptation.episode_count = eps.length;
    adaptation.total_duration = eps.reduce((t, e) => t + e.duration, 0);
    adaptations.push(adaptation);
    episodes[adaptation.id] = eps;
  });

  if (!adaptations.length) throw new Error('No se pudo generar ningún guion.');
  return { adaptations, episodes, characters };
}
