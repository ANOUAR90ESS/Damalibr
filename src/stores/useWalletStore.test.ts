// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Episode } from '../types';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const { useWalletStore } = await import('./useWalletStore');
const { useAuthStore } = await import('./useAuthStore');

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-test-1',
    adaptation_id: 'ad-test',
    book_id: 'book-test',
    number: 6,
    title: 'Episodio de prueba',
    format: 'drama',
    script_json: { adaptation_id: 'ad-test', episode_number: 6, scenes: [] },
    video_url: '',
    thumbnail_url: '',
    duration: 90,
    is_free: false,
    coin_price: 10,
    story_position_start: 0,
    story_position_end: 0.1,
    cliffhanger: '',
    ...overrides,
  };
}

describe('useWalletStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().setVipStatus(false);
    useWalletStore.setState({ coins: 60, unlockedEpisodeIds: [], transactions: [], coinShopModalOpen: false });
  });

  describe('isEpisodeAccessible', () => {
    it('allows free episodes', () => {
      expect(useWalletStore.getState().isEpisodeAccessible(makeEpisode({ is_free: true }))).toBe(true);
    });

    it('allows summaries', () => {
      expect(useWalletStore.getState().isEpisodeAccessible(makeEpisode({ format: 'summary' }))).toBe(true);
    });

    it('allows everything for VIP users', () => {
      useAuthStore.getState().setVipStatus(true);
      expect(useWalletStore.getState().isEpisodeAccessible(makeEpisode())).toBe(true);
    });

    it('blocks paid episodes that are not unlocked', () => {
      expect(useWalletStore.getState().isEpisodeAccessible(makeEpisode())).toBe(false);
    });
  });

  describe('unlockEpisode', () => {
    it('spends coins and records the unlock', () => {
      const episode = makeEpisode();
      expect(useWalletStore.getState().unlockEpisode(episode)).toBe(true);

      const state = useWalletStore.getState();
      expect(state.coins).toBe(50);
      expect(state.unlockedEpisodeIds).toContain(episode.id);
      expect(state.transactions[0]).toMatchObject({ type: 'spend', amount: -10 });
      expect(JSON.parse(localStorage.getItem('lamina_coins')!)).toBe(50);
    });

    it('opens the coin shop and does not unlock when coins are insufficient', () => {
      useWalletStore.setState({ coins: 5 });
      expect(useWalletStore.getState().unlockEpisode(makeEpisode())).toBe(false);

      const state = useWalletStore.getState();
      expect(state.coins).toBe(5);
      expect(state.unlockedEpisodeIds).toHaveLength(0);
      expect(state.coinShopModalOpen).toBe(true);
    });

    it('does not charge twice for an already unlocked episode', () => {
      const episode = makeEpisode();
      useWalletStore.getState().unlockEpisode(episode);
      useWalletStore.getState().unlockEpisode(episode);
      expect(useWalletStore.getState().coins).toBe(50);
    });
  });
});
