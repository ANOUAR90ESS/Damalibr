import { describe, expect, it } from 'vitest';
import { analyzeBook, normalizeCharacters, sampleText } from './analyze';
import { generateAdaptations } from './adapt';
import { buildAss } from './render';
import type { AI } from './common';
import type { Chapter } from './ingest';

const PLAY: Chapter[] = [
  { title: 'ACTO PRIMERO', text: 'MADRE: Hijo, el almuerzo está listo en la mesa desde hace rato.\nNOVIO: Déjalo, comeré uvas por el camino hacia la viña.\nMADRE: La navaja, la navaja. Malditas sean todas y el bribón que las inventó.' },
  { title: 'ACTO SEGUNDO', text: 'NOVIA: No quiero hablar de eso ahora, déjame tranquila un momento.\nLEONARDO: ¿Quién ha dicho que yo venga a hablar contigo esta noche?\nNOVIA: Tu caballo se ha visto en la puerta de mi casa muchas veces.' },
  { title: 'ACTO TERCERO', text: 'MADRE: Vecinas, con un cuchillo, con un cuchillito, en un día señalado.\nNOVIA: Yo era una mujer quemada, llena de llagas por dentro y por fuera.' },
];

const fakeAI = (payload: object): AI => ({
  models: { generateContent: async () => ({ text: JSON.stringify(payload) }) } as any,
});

describe('normalizeCharacters', () => {
  it('assigns distinct voices by gender and sanitizes fields', () => {
    const chars = normalizeCharacters('book-bodas', [
      { name: 'Madre', gender: 'femenino', role: 'protagonista' },
      { name: 'Novia', gender: 'femenino', role: 'villana' },
      { name: 'madre', gender: 'femenino' },
      { name: 'Leonardo', gender: 'otro' },
      { name: '  ' },
    ]);
    expect(chars.map(c => c.name)).toEqual(['Madre', 'Novia', 'Leonardo']);
    expect(chars[0].voice_id).not.toBe(chars[1].voice_id);
    expect(chars[1].role).toBe('secundario');
    expect(chars[2].gender).toBe('neutro');
    expect(chars[0].id).toMatch(/^char-bodas-madre-1$/);
  });
});

describe('sampleText', () => {
  it('samples across the whole book within the budget', () => {
    const chapters = Array.from({ length: 100 }, (_, i) => ({ title: `C${i}`, text: 'x'.repeat(5000) }));
    const sample = sampleText(chapters, 12_000);
    expect(sample.length).toBeLessThanOrEqual(12_000);
    expect(sample).toContain('## C0');
    expect(sample).toContain('## C90');
  });
});

describe('analyzeBook', () => {
  it('finds the cast from dialogue in simulated mode', async () => {
    const { characters, meta } = await analyzeBook(null, { bookId: 'book-bodas', title: 'Bodas de sangre', author: 'Lorca', chapters: PLAY });
    expect(characters.map(c => c.name)).toEqual(expect.arrayContaining(['Madre', 'Novia']));
    expect(meta.synopsis).toBeTruthy();
    expect(meta.year).toBeNull();
  });

  it('parses and validates the model response', async () => {
    const ai = fakeAI({
      book: { synopsis: 'Una boda trágica.', genres: ['Tragedia'], era: 'Inventada', year: 1933, kids_friendly: false },
      characters: [{ name: 'La Madre', description: 'Doliente', role: 'protagonista', personality: 'Severa', gender: 'femenino', age_range: '60' }],
    });
    const { characters, meta } = await analyzeBook(ai, { bookId: 'book-bodas', title: 'Bodas', author: 'Lorca', chapters: PLAY });
    expect(characters[0]).toMatchObject({ name: 'La Madre', role: 'protagonista', voice_id: 'Kore' });
    expect(meta).toMatchObject({ synopsis: 'Una boda trágica.', era: 'Clásicos', year: 1933 });
  });
});

describe('generateAdaptations', () => {
  const base = async () => {
    const { characters } = await analyzeBook(null, { bookId: 'book-bodas', title: 'Bodas', author: 'Lorca', chapters: PLAY });
    return { bookId: 'book-bodas', title: 'Bodas', author: 'Lorca', coverUrl: 'cover.png', characters, chapters: PLAY, visualMode: 'economic' as const, dramaEpisodes: 7 };
  };

  it('builds drama, film and summary with continuous story positions and pricing', async () => {
    const { adaptations, episodes, characters } = await generateAdaptations(null, await base());
    expect(adaptations.map(a => [a.id, a.format, a.aspect_ratio, a.episode_count])).toEqual([
      ['adapt-bodas-drama', 'drama', '9:16', 7],
      ['adapt-bodas-film', 'film', '16:9', 1],
      ['adapt-bodas-summary', 'summary', '9:16', 1],
    ]);
    const drama = episodes['adapt-bodas-drama'];
    expect(drama[0].story_position_start).toBe(0);
    expect(drama[6].story_position_end).toBe(1);
    drama.slice(1).forEach((ep, i) => expect(ep.story_position_start).toBe(drama[i].story_position_end));
    expect(drama.map(e => e.is_free)).toEqual([true, true, true, true, true, false, false]);
    expect(drama[6].coin_price).toBe(10);
    expect(episodes['adapt-bodas-film'][0]).toMatchObject({ is_free: false, coin_price: 25 });
    expect(episodes['adapt-bodas-summary'][0]).toMatchObject({ is_free: true, coin_price: 0 });
    // Summary is narrated, so the narrator joins the cast
    expect(characters.some(c => c.role === 'narrador')).toBe(true);
    const line = drama[0].script_json.scenes[0].lines[0];
    expect(characters.map(c => c.id)).toContain(line.character_id);
  });

  it('maps model output to known characters and drops empty scenes', async () => {
    const ai = fakeAI({
      episodes: [{
        title: 'La navaja', cliffhanger: '¿Volverá?',
        scenes: [
          { setting: 'Cocina', visual_prompt: 'A kitchen', lines: [{ character_name: 'MADRE', text: 'La navaja.', emotion: 'furioso' }, { character_name: 'Desconocido', text: 'Hola.', emotion: 'raro' }] },
          { setting: 'Vacía', visual_prompt: 'x', lines: [] },
        ],
      }],
    });
    const input = await base();
    const { episodes } = await generateAdaptations(ai, input);
    const ep = episodes['adapt-bodas-drama'][0];
    expect(ep.script_json.scenes).toHaveLength(1);
    const [l1, l2] = ep.script_json.scenes[0].lines;
    expect(l1.character_name).toBe('Madre');
    expect(l2).toMatchObject({ character_name: 'Narrador', emotion: 'neutro' });
  });
});

describe('buildAss', () => {
  it('escapes override braces and formats times', () => {
    const ass = buildAss([{ start: 61.5, end: 3725.25, speaker: 'Don {Quijote}', text: 'Línea\nsegunda' }], 720, 1280);
    expect(ass).toContain('Dialogue: 0,0:01:01.50,1:02:05.25,Default,,0,0,0,,{\\c&H24BFFB&\\b1}Don Quijote{\\r}\\NLínea\\Nsegunda');
    expect(ass).toContain('PlayResY: 1280');
  });
});

describe('simulated scripts', () => {
  it('keeps the real speaker of each dialogue line', async () => {
    const { characters } = await analyzeBook(null, { bookId: 'book-bodas', title: 'Bodas', author: 'Lorca', chapters: PLAY });
    const { episodes } = await generateAdaptations(null, { bookId: 'book-bodas', title: 'Bodas', author: 'Lorca', coverUrl: '', characters, chapters: PLAY, visualMode: 'economic', dramaEpisodes: 3 });
    const lines = episodes['adapt-bodas-drama'].flatMap(e => e.script_json.scenes.flatMap(s => s.lines));
    expect(lines.find(l => l.text.startsWith('Hijo, el almuerzo'))?.character_name).toBe('Madre');
    expect(lines.find(l => l.text.startsWith('No quiero hablar'))?.character_name).toBe('Novia');
    expect(lines.every(l => !/^[A-ZÁÉÍÓÚÑ]{3,}:/.test(l.text))).toBe(true);
  });
});
