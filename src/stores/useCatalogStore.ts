import { create } from 'zustand';
import { Catalog, SEED_CATALOG, fetchCatalog } from '../lib/api/catalog';

interface CatalogState extends Catalog {
  source: 'seed' | 'supabase';
  loadCatalog: () => Promise<void>;
}

// Starts with the bundled seed catalog so the UI renders instantly (and offline),
// then swaps in the Supabase catalog when one is configured and not empty.
export const useCatalogStore = create<CatalogState>((set) => ({
  ...SEED_CATALOG,
  source: 'seed',

  loadCatalog: async () => {
    try {
      const catalog = await fetchCatalog();
      if (catalog) set({ ...catalog, source: 'supabase' });
    } catch (e) {
      console.warn('No se pudo cargar el catálogo desde Supabase; se usa el catálogo local.', e);
    }
  },
}));
