import { create } from 'zustand';
import { storageService } from '../lib/supabase';
import { LibraryItem, UserProgress } from '../types';

interface LibraryState {
  items: Record<string, LibraryItem>; // key: book_id
  progress: Record<string, UserProgress>; // key: `${book_id}_${adaptation_id}_${episode_id}`
  likedBookIds: string[];

  // Actions
  setBookState: (bookId: string, state: 'to_watch' | 'started' | 'finished') => void;
  toggleBookmark: (bookId: string) => void;
  toggleLike: (bookId: string) => void;
  saveProgress: (bookId: string, adaptationId: string, episodeId: string, seconds: number, completed?: boolean) => void;
  getProgress: (bookId: string, adaptationId: string, episodeId: string) => UserProgress | undefined;
  getBookLatestProgress: (bookId: string) => UserProgress | undefined;
  downloadEpisodeOffline: (bookId: string, episodeId: string, sizeMb?: number) => void;
  removeOfflineDownload: (bookId: string) => void;
  isBookDownloaded: (bookId: string) => boolean;
}

const DEFAULT_LIBRARY_ITEMS: Record<string, LibraryItem> = {
  'book-quijote': {
    user_id: 'usr-lamina-demo',
    book_id: 'book-quijote',
    state: 'started',
    is_bookmarked: true,
    is_downloaded: true,
    download_size_mb: 48.5,
    updated_at: new Date().toISOString(),
  },
  'book-celestina': {
    user_id: 'usr-lamina-demo',
    book_id: 'book-celestina',
    state: 'to_watch',
    is_bookmarked: true,
    is_downloaded: false,
    updated_at: new Date().toISOString(),
  }
};

const DEFAULT_PROGRESS: Record<string, UserProgress> = {
  'book-quijote_adapt-quijote-drama_ep-q-1': {
    user_id: 'usr-lamina-demo',
    book_id: 'book-quijote',
    adaptation_id: 'adapt-quijote-drama',
    episode_id: 'ep-q-1',
    seconds: 125,
    completed: true,
    updated_at: new Date().toISOString(),
  },
  'book-quijote_adapt-quijote-drama_ep-q-2': {
    user_id: 'usr-lamina-demo',
    book_id: 'book-quijote',
    adaptation_id: 'adapt-quijote-drama',
    episode_id: 'ep-q-2',
    seconds: 74,
    completed: false,
    updated_at: new Date().toISOString(),
  }
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: storageService.get<Record<string, LibraryItem>>('library_items', DEFAULT_LIBRARY_ITEMS),
  progress: storageService.get<Record<string, UserProgress>>('user_progress', DEFAULT_PROGRESS),
  likedBookIds: storageService.get<string[]>('liked_books', ['book-quijote', 'book-regenta']),

  setBookState: (bookId: string, state: 'to_watch' | 'started' | 'finished') => {
    const items = { ...get().items };
    const current = items[bookId] || {
      user_id: 'usr-lamina-demo',
      book_id: bookId,
      state: 'to_watch',
      is_bookmarked: false,
      is_downloaded: false,
      updated_at: new Date().toISOString(),
    };

    items[bookId] = {
      ...current,
      state,
      updated_at: new Date().toISOString(),
    };

    storageService.set('library_items', items);
    set({ items });
  },

  toggleBookmark: (bookId: string) => {
    const items = { ...get().items };
    const current = items[bookId] || {
      user_id: 'usr-lamina-demo',
      book_id: bookId,
      state: 'to_watch',
      is_bookmarked: false,
      is_downloaded: false,
      updated_at: new Date().toISOString(),
    };

    items[bookId] = {
      ...current,
      is_bookmarked: !current.is_bookmarked,
      updated_at: new Date().toISOString(),
    };

    storageService.set('library_items', items);
    set({ items });
  },

  toggleLike: (bookId: string) => {
    const { likedBookIds } = get();
    const updated = likedBookIds.includes(bookId)
      ? likedBookIds.filter(id => id !== bookId)
      : [...likedBookIds, bookId];

    storageService.set('liked_books', updated);
    set({ likedBookIds: updated });
  },

  saveProgress: (bookId: string, adaptationId: string, episodeId: string, seconds: number, completed = false) => {
    const progress = { ...get().progress };
    const key = `${bookId}_${adaptationId}_${episodeId}`;

    progress[key] = {
      user_id: 'usr-lamina-demo',
      book_id: bookId,
      adaptation_id: adaptationId,
      episode_id: episodeId,
      seconds,
      completed,
      updated_at: new Date().toISOString(),
    };

    // Also auto-mark book as started in library if not already
    const items = { ...get().items };
    if (!items[bookId] || items[bookId].state === 'to_watch') {
      items[bookId] = {
        user_id: 'usr-lamina-demo',
        book_id: bookId,
        state: 'started',
        is_bookmarked: items[bookId]?.is_bookmarked || false,
        is_downloaded: items[bookId]?.is_downloaded || false,
        updated_at: new Date().toISOString(),
      };
      storageService.set('library_items', items);
      set({ items });
    }

    storageService.set('user_progress', progress);
    set({ progress });
  },

  getProgress: (bookId: string, adaptationId: string, episodeId: string) => {
    const key = `${bookId}_${adaptationId}_${episodeId}`;
    return get().progress[key];
  },

  getBookLatestProgress: (bookId: string) => {
    const all = Object.values(get().progress).filter(p => p.book_id === bookId);
    if (!all.length) return undefined;
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  },

  downloadEpisodeOffline: (bookId: string, _episodeId: string, sizeMb = 35.4) => {
    const items = { ...get().items };
    const current = items[bookId] || {
      user_id: 'usr-lamina-demo',
      book_id: bookId,
      state: 'started',
      is_bookmarked: false,
      is_downloaded: false,
      updated_at: new Date().toISOString(),
    };

    items[bookId] = {
      ...current,
      is_downloaded: true,
      download_size_mb: (current.download_size_mb || 0) + sizeMb,
      updated_at: new Date().toISOString(),
    };

    storageService.set('library_items', items);
    set({ items });
  },

  removeOfflineDownload: (bookId: string) => {
    const items = { ...get().items };
    if (items[bookId]) {
      items[bookId] = {
        ...items[bookId],
        is_downloaded: false,
        download_size_mb: 0,
        updated_at: new Date().toISOString(),
      };
      storageService.set('library_items', items);
      set({ items });
    }
  },

  isBookDownloaded: (bookId: string) => {
    return Boolean(get().items[bookId]?.is_downloaded);
  }
}));
