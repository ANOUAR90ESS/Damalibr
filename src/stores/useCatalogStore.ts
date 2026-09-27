import { create } from 'zustand';
import { Catalog, SEED_CATALOG, fetchCatalog } from '../lib/api/catalog';
import type { PublishedBundle } from '../lib/api/pipeline';
import { isSupabaseConfigured, storageService } from '../lib/supabase';

interface CatalogState extends Catalog {
  source: 'seed' | 'supabase';
  loadCatalog: () => Promise<void>;
  /** Adds a book published from the Estudio IA to the catalog. */
  addPublished: (bundle: PublishedBundle) => Promise<void>;
}

const PUBLISHED_KEY = 'published_catalog';

function mergeBundle(catalog: Catalog, bundle: PublishedBundle): Catalog {
  return {
    books: [bundle.book, ...catalog.books.filter(b => b.id !== bundle.book.id)],
    charactersByBook: { ...catalog.charactersByBook, [bundle.book.id]: bundle.characters },
    adaptationsByBook: { ...catalog.adaptationsByBook, [bundle.book.id]: bundle.adaptations },
    episodesByAdaptation: { ...catalog.episodesByAdaptation, ...bundle.episodes },
  };
}

// Local demo mode keeps books published from the studio in LocalStorage.
const localCatalog = () =>
  storageService.get<PublishedBundle[]>(PUBLISHED_KEY, []).reduce(mergeBundle, SEED_CATALOG);

// Starts with the bundled seed catalog so the UI renders instantly (and offline),
// then swaps in the Supabase catalog when one is configured and not empty.
export const useCatalogStore = create<CatalogState>((set, get) => ({
  ...(isSupabaseConfigured ? SEED_CATALOG : localCatalog()),
  source: 'seed',

  loadCatalog: async () => {
    try {
      const catalog = await fetchCatalog();
      if (catalog) set({ ...catalog, source: 'supabase' });
    } catch (e) {
      console.warn('No se pudo cargar el catálogo desde Supabase; se usa el catálogo local.', e);
    }
  },

  addPublished: async (bundle) => {
    if (isSupabaseConfigured) {
      // The server already wrote it to the database.
      await get().loadCatalog();
      return;
    }
    const stored = storageService.get<PublishedBundle[]>(PUBLISHED_KEY, []).filter(b => b.book.id !== bundle.book.id);
    storageService.set(PUBLISHED_KEY, [...stored, bundle]);
    set(mergeBundle(get(), bundle));
  },
}));
