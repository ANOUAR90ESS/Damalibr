// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchLibrary: vi.fn(),
  upsertLibraryItem: vi.fn(() => Promise.resolve()),
  upsertProgress: vi.fn(() => Promise.resolve()),
  setLike: vi.fn(() => Promise.resolve()),
}));
vi.mock('../lib/api/userData', () => api);

const { useLibraryStore } = await import('./useLibraryStore');

const USER = '11111111-1111-1111-1111-111111111111';

describe('useLibraryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useLibraryStore.getState().resetToLocal();
  });

  it('keeps guest data in localStorage without calling the API', () => {
    useLibraryStore.getState().toggleBookmark('book-regenta');
    expect(JSON.parse(localStorage.getItem('lamina_library_items')!)['book-regenta'].is_bookmarked).toBe(true);
    expect(api.upsertLibraryItem).not.toHaveBeenCalled();
  });

  describe('when signed in', () => {
    beforeEach(async () => {
      api.fetchLibrary.mockResolvedValue({
        items: [{ user_id: USER, book_id: 'book-celestina', state: 'finished', is_bookmarked: false, is_downloaded: false, updated_at: '2026-01-01' }],
        progress: [{ user_id: USER, book_id: 'book-celestina', adaptation_id: 'a', episode_id: 'e', seconds: 30, completed: false, updated_at: '2026-01-01' }],
        likedBookIds: ['book-celestina'],
      });
      await useLibraryStore.getState().loadRemote(USER);
    });

    it('replaces local data with the remote library', () => {
      const state = useLibraryStore.getState();
      expect(Object.keys(state.items)).toEqual(['book-celestina']);
      expect(state.getProgress('book-celestina', 'a', 'e')?.seconds).toBe(30);
      expect(state.likedBookIds).toEqual(['book-celestina']);
    });

    it('syncs library and like changes to Supabase instead of localStorage', () => {
      useLibraryStore.getState().toggleBookmark('book-quijote');
      expect(api.upsertLibraryItem).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER, book_id: 'book-quijote', is_bookmarked: true }));

      useLibraryStore.getState().toggleLike('book-celestina');
      expect(api.setLike).toHaveBeenCalledWith(USER, 'book-celestina', false);

      expect(localStorage.getItem('lamina_library_items')).toBeNull();
      expect(localStorage.getItem('lamina_liked_books')).toBeNull();
    });

    it('throttles progress uploads but always sends completion', () => {
      const { saveProgress } = useLibraryStore.getState();
      saveProgress('book-quijote', 'adapt-quijote-drama', 'ep-q-1', 1);
      saveProgress('book-quijote', 'adapt-quijote-drama', 'ep-q-1', 2);
      saveProgress('book-quijote', 'adapt-quijote-drama', 'ep-q-1', 3);
      expect(api.upsertProgress).toHaveBeenCalledTimes(1);

      saveProgress('book-quijote', 'adapt-quijote-drama', 'ep-q-1', 120, true);
      expect(api.upsertProgress).toHaveBeenCalledTimes(2);
      expect(api.upsertProgress).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: USER, seconds: 120, completed: true }));
    });

    it('restores the guest library after signing out', () => {
      localStorage.setItem('lamina_liked_books', JSON.stringify(['book-regenta']));
      useLibraryStore.getState().resetToLocal();
      const state = useLibraryStore.getState();
      expect(state.remoteUserId).toBeNull();
      expect(state.likedBookIds).toEqual(['book-regenta']);
    });
  });
});
