import { Type } from '@google/genai';
import type { Character } from '../../src/types';

export interface BookMeta {
  synopsis: string;
  genres: string[];
  era: string;
  year: number | null;
  kids_friendly: boolean;
}

export interface AnalysisResult {
  characters: Character[];
  meta: BookMeta;
}

const ERAS = ['Renacimiento', 'Siglo de Oro', 'Ilustración', 'Romanticismo', 'Realismo', 'Modernismo', 'Generación del 98', 'Vanguardias', 'Clásicos'];
import { AI, models, slugify } from './common';
import type { Chapter } from './ingest';

// Prebuilt Gemini TTS voices, grouped so each character gets a distinct, fitting voice.
const VOICES = {
  femenino: ['Kore', 'Aoede', 'Leda', 'Zephyr', 'Callirrhoe', 'Despina'],
  masculino: ['Charon', 'Fenrir', 'Orus', 'Puck', 'Iapetus', 'Algenib'],
  neutro: ['Sadaltager', 'Achird', 'Umbriel'],
};
export const NARRATOR_VOICE = 'Charon';

const ROLES: Character['role'][] = ['protagonista', 'antagonista', 'secundario', 'narrador'];
const GENDERS: Character['gender'][] = ['masculino', 'femenino', 'neutro'];

interface RawCharacter {
  name?: string;
  description?: string;
  role?: string;
  personality?: string;
  gender?: string;
  age_range?: string;
}

export function normalizeCharacters(bookId: string, raw: RawCharacter[]): Character[] {
  const used: Record<string, number> = { femenino: 0, masculino: 0, neutro: 0 };
  const seen = new Set<string>();

  return raw
    .filter(c => c.name && c.name.trim())
    .filter(c => {
      const key = c.name!.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map((c, i) => {
      const gender = GENDERS.includes(c.gender as Character['gender']) ? (c.gender as Character['gender']) : 'neutro';
      const pool = VOICES[gender];
      const voice = pool[used[gender]++ % pool.length];
      const name = c.name!.trim();
      return {
        id: `char-${bookId.replace(/^book-/, '')}-${slugify(name)}-${i + 1}`,
        book_id: bookId,
        name,
        description: (c.description || '').trim() || `Personaje de la obra.`,
        role: ROLES.includes(c.role as Character['role']) ? (c.role as Character['role']) : 'secundario',
        personality: (c.personality || '').trim(),
        gender,
        age_range: (c.age_range || '').trim(),
        voice_id: voice,
        voice_name: voice,
        avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
      };
    });
}

export function narratorFor(bookId: string): Character {
  return {
    id: `char-${bookId.replace(/^book-/, '')}-narrador`,
    book_id: bookId,
    name: 'Narrador',
    description: 'Voz narradora que guía la historia.',
    role: 'narrador',
    personality: 'Sereno y evocador',
    gender: 'neutro',
    age_range: '',
    voice_id: NARRATOR_VOICE,
    voice_name: NARRATOR_VOICE,
    avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=Narrador',
  };
}

// Samples the whole book (not just the opening): evenly spaced chapters, the start of each.
export function sampleText(chapters: Chapter[], maxChars: number): string {
  if (!chapters.length) return '';
  const count = Math.max(1, Math.min(chapters.length, Math.floor(maxChars / 1200)));
  const step = chapters.length / count;
  const per = Math.floor(maxChars / count);
  return Array.from({ length: count }, (_, i) => chapters[Math.floor(i * step)])
    .map(c => `## ${c.title}\n${c.text.slice(0, per)}`)
    .join('\n\n')
    .slice(0, maxChars);
}

function simulatedCharacters(title: string, chapters: Chapter[]): RawCharacter[] {
  // Pick capitalized names that repeat in dialogue-like positions ("NAME:" or "—dijo Name").
  const text = chapters.map(c => c.text).join('\n');
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{2,24}):/gm)) {
    const name = m[1].trim();
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
  const found = names.map((n, i) => ({
    name: n.charAt(0) + n.slice(1).toLowerCase(),
    description: `Personaje de ${title}.`,
    role: i === 0 ? 'protagonista' : i === 1 ? 'antagonista' : 'secundario',
    personality: '',
    gender: i % 2 === 0 ? 'masculino' : 'femenino',
    age_range: '',
  }));
  if (found.length >= 2) return found;
  return [
    { name: 'Protagonista', description: `Personaje central de ${title}.`, role: 'protagonista', gender: 'masculino' },
    { name: 'Antagonista', description: `Rival que desafía el orden en ${title}.`, role: 'antagonista', gender: 'femenino' },
  ];
}

export function normalizeMeta(raw: Partial<BookMeta> | undefined, fallbackSynopsis: string): BookMeta {
  const year = Number(raw?.year);
  return {
    synopsis: (raw?.synopsis || '').trim() || fallbackSynopsis,
    genres: Array.isArray(raw?.genres) ? raw!.genres.map(g => String(g).trim()).filter(Boolean).slice(0, 5) : [],
    era: ERAS.includes(raw?.era || '') ? raw!.era! : 'Clásicos',
    year: Number.isInteger(year) && year > 800 && year < 2100 ? year : null,
    kids_friendly: Boolean(raw?.kids_friendly),
  };
}

const firstParagraph = (chapters: Chapter[]) =>
  (chapters[0]?.text || '').split(/\n\s*\n/).find(p => p.trim().length > 80)?.trim().slice(0, 400) || '';

export async function analyzeBook(
  ai: AI | null,
  { bookId, title, author, chapters }: { bookId: string; title: string; author: string; chapters: Chapter[] },
): Promise<AnalysisResult> {
  if (!ai) {
    return {
      characters: normalizeCharacters(bookId, simulatedCharacters(title, chapters)),
      meta: normalizeMeta(undefined, firstParagraph(chapters) || `${title}, de ${author}.`),
    };
  }

  const response = await ai.models.generateContent({
    model: models.text(),
    contents: `Analiza la siguiente obra clásica en dominio público. Devuelve:
1. "book": sinopsis atractiva de 2-3 frases sin destripar el final, hasta 4 géneros, época literaria (${ERAS.join(', ')}), año de publicación y si es apta para niños.
2. "characters": sus personajes principales y secundarios (máximo 10) con nombre, descripción, rol (protagonista, antagonista, secundario), personalidad, género (masculino, femenino, neutro) y edad aproximada.
Obra: "${title}" de ${author}.
Fragmentos representativos de toda la obra:
${sampleText(chapters, 30_000)}`,
    config: {
      systemInstruction: 'Eres un dramaturgista experto en adaptar literatura clásica española a microdramas verticales 9:16.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          book: {
            type: Type.OBJECT,
            properties: {
              synopsis: { type: Type.STRING },
              genres: { type: Type.ARRAY, items: { type: Type.STRING } },
              era: { type: Type.STRING, enum: ERAS },
              year: { type: Type.INTEGER },
              kids_friendly: { type: Type.BOOLEAN },
            },
            required: ['synopsis', 'genres', 'era', 'year', 'kids_friendly'],
          },
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                role: { type: Type.STRING, enum: ['protagonista', 'antagonista', 'secundario'] },
                personality: { type: Type.STRING },
                gender: { type: Type.STRING, enum: ['masculino', 'femenino', 'neutro'] },
                age_range: { type: Type.STRING },
              },
              required: ['name', 'description', 'role', 'personality', 'gender', 'age_range'],
            },
          },
        },
        required: ['book', 'characters'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  const characters = normalizeCharacters(bookId, parsed.characters || []);
  if (!characters.length) throw new Error('El modelo no devolvió personajes.');
  return { characters, meta: normalizeMeta(parsed.book, firstParagraph(chapters) || `${title}, de ${author}.`) };
}
