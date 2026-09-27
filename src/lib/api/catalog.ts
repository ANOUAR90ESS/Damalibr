import { supabase } from '../supabase';
import { Adaptation, Book, Character, Episode } from '../../types';
import { SEED_ADAPTATIONS, SEED_BOOKS, SEED_CHARACTERS, SEED_EPISODES } from '../../data/seedBooks';

export interface Catalog {
  books: Book[];
  charactersByBook: Record<string, Character[]>;
  adaptationsByBook: Record<string, Adaptation[]>;
  episodesByAdaptation: Record<string, Episode[]>;
}

export const SEED_CATALOG: Catalog = {
  books: SEED_BOOKS,
  charactersByBook: SEED_CHARACTERS,
  adaptationsByBook: SEED_ADAPTATIONS,
  episodesByAdaptation: SEED_EPISODES,
};

function groupBy<T>(rows: T[], key: (row: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const row of rows) {
    (out[key(row)] ||= []).push(row);
  }
  return out;
}

// PostgREST returns NUMERIC columns as strings in some setups; normalize them.
const num = (v: unknown) => (typeof v === 'string' ? Number(v) : (v as number));

export function buildCatalog(rows: {
  books: Book[];
  characters: Character[];
  adaptations: Adaptation[];
  episodes: Episode[];
}): Catalog {
  const episodes = rows.episodes
    .map(e => ({
      ...e,
      story_position_start: num(e.story_position_start),
      story_position_end: num(e.story_position_end),
      hls_url: e.hls_url ?? undefined,
    }))
    .sort((a, b) => a.number - b.number);

  return {
    books: rows.books.map(b => ({ ...b, rating: num(b.rating), total_views: num(b.total_views) })),
    charactersByBook: groupBy(rows.characters, c => c.book_id),
    adaptationsByBook: groupBy(rows.adaptations, a => a.book_id),
    episodesByAdaptation: groupBy(episodes, e => e.adaptation_id),
  };
}

// Loads the published catalog from Supabase. Returns null when Supabase is not
// configured or the catalog is empty, so callers keep the bundled seed data.
export async function fetchCatalog(): Promise<Catalog | null> {
  if (!supabase) return null;

  const [books, characters, adaptations, episodes] = await Promise.all([
    supabase.from('books').select('*').order('total_views', { ascending: false }),
    supabase.from('characters').select('*'),
    supabase.from('adaptations').select('*'),
    supabase.from('episodes').select('*'),
  ]);

  const error = books.error || characters.error || adaptations.error || episodes.error;
  if (error) throw error;
  if (!books.data?.length) return null;

  return buildCatalog({
    books: books.data as Book[],
    characters: (characters.data || []) as Character[],
    adaptations: (adaptations.data || []) as Adaptation[],
    episodes: (episodes.data || []) as Episode[],
  });
}
