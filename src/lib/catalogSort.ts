import { Book } from '../types';

export type CatalogSort = 'relevance' | 'rating' | 'popular' | 'oldest' | 'title';

export const CATALOG_SORT_OPTIONS: Array<{ id: CatalogSort; label: string }> = [
  { id: 'relevance', label: 'Relevancia' },
  { id: 'rating', label: 'Mejor valorados' },
  { id: 'popular', label: 'Más vistos' },
  { id: 'oldest', label: 'Más antiguos' },
  { id: 'title', label: 'Título (A-Z)' },
];

/** Returns a sorted copy; 'relevance' keeps the catalog order. */
export function sortBooks(books: Book[], sort: CatalogSort): Book[] {
  const list = [...books];
  switch (sort) {
    case 'rating':
      return list.sort((a, b) => b.rating - a.rating);
    case 'popular':
      return list.sort((a, b) => b.total_views - a.total_views);
    case 'oldest':
      return list.sort((a, b) => a.year - b.year);
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    default:
      return list;
  }
}
