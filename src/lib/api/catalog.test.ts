import { describe, expect, it } from 'vitest';
import { buildCatalog, SEED_CATALOG } from './catalog';
import type { Adaptation, Book, Character, Episode } from '../../types';

describe('buildCatalog', () => {
  it('groups rows by parent id and sorts episodes by number', () => {
    const books = SEED_CATALOG.books.slice(0, 1);
    const adaptations = SEED_CATALOG.adaptationsByBook[books[0].id];
    const episodes = [...SEED_CATALOG.episodesByAdaptation[adaptations[0].id]].reverse();
    const characters = SEED_CATALOG.charactersByBook[books[0].id];

    const catalog = buildCatalog({ books, characters, adaptations, episodes });

    expect(catalog.books).toHaveLength(1);
    expect(catalog.charactersByBook[books[0].id]).toHaveLength(characters.length);
    expect(catalog.adaptationsByBook[books[0].id]).toHaveLength(adaptations.length);
    const numbers = catalog.episodesByAdaptation[adaptations[0].id].map(e => e.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it('converts NUMERIC strings from PostgREST into numbers and drops null hls_url', () => {
    const catalog = buildCatalog({
      books: [{ id: 'b', rating: '4.95', total_views: '10' } as unknown as Book],
      characters: [] as Character[],
      adaptations: [] as Adaptation[],
      episodes: [{
        id: 'e', adaptation_id: 'a', number: 1,
        story_position_start: '0.1000', story_position_end: '0.2500', hls_url: null,
      } as unknown as Episode],
    });

    expect(catalog.books[0].rating).toBe(4.95);
    expect(catalog.books[0].total_views).toBe(10);
    const ep = catalog.episodesByAdaptation.a[0];
    expect(ep.story_position_start).toBe(0.1);
    expect(ep.story_position_end).toBe(0.25);
    expect(ep.hls_url).toBeUndefined();
  });
});
