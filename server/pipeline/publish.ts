import type { SupabaseClient } from '@supabase/supabase-js';
import type { Adaptation, Book, Character, Episode } from '../../src/types';

export interface CatalogBundle {
  book: Book;
  characters: Character[];
  adaptations: Adaptation[];
  episodes: Record<string, Episode[]>;
}

/** Strips pipeline-only fields so rows match the database columns. */
function episodeRow(ep: Episode) {
  const { script_json, ...rest } = ep;
  return {
    ...rest,
    hls_url: ep.hls_url || null,
    script_json: {
      ...script_json,
      scenes: script_json.scenes.map(({ image_path: _i, ...scene }) => ({
        ...scene,
        lines: scene.lines.map(({ audio_path: _a, ...line }) => line),
      })),
    },
  };
}

export function toPublishedBundle(bundle: CatalogBundle): CatalogBundle {
  const episodes = Object.fromEntries(
    Object.entries(bundle.episodes).map(([id, eps]) => [id, eps.map(ep => episodeRow(ep) as Episode)]),
  );
  return {
    book: { ...bundle.book, status: 'ready' },
    characters: bundle.characters,
    adaptations: bundle.adaptations.map(a => ({ ...a, status: 'ready' })),
    episodes,
  };
}

/** Upserts the whole book into the catalog tables (service role). */
export async function publishToSupabase(admin: SupabaseClient, bundle: CatalogBundle): Promise<void> {
  const b = toPublishedBundle(bundle);
  const steps: Array<[string, object[]]> = [
    ['books', [b.book]],
    ['characters', b.characters],
    ['adaptations', b.adaptations],
    ['episodes', Object.values(b.episodes).flat()],
  ];
  for (const [table, rows] of steps) {
    if (!rows.length) continue;
    const { error } = await admin.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Error publicando ${table}: ${error.message}`);
  }
}
