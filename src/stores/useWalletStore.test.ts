// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Episode } from '../types';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const api = vi.hoisted(() => ({
  fetchWallet: vi.fn(),
  unlockEpisodeRemote: vi.fn(),
  createCheckout: vi.fn(),
  createBillingPortal: vi.fn(),
}));
vi.mock('../lib/api/wallet', () => api);

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
    vi.clearAllMocks();
    useWalletStore.getState().resetToLocal();
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
    it('spends coins and records the unlock', async () => {
      const episode = makeEpisode();
      expect(await useWalletStore.getState().unlockEpisode(episode)).toBe(true);

      const state = useWalletStore.getState();
      expect(state.coins).toBe(50);
      expect(state.unlockedEpisodeIds).toContain(episode.id);
      expect(state.transactions[0]).toMatchObject({ type: 'spend', amount: -10 });
      expect(JSON.parse(localStorage.getItem('lamina_coins')!)).toBe(50);
    });

    it('opens the coin shop and does not unlock when coins are insufficient', async () => {
      useWalletStore.setState({ coins: 5 });
      expect(await useWalletStore.getState().unlockEpisode(makeEpisode())).toBe(false);

      const state = useWalletStore.getState();
      expect(state.coins).toBe(5);
      expect(state.unlockedEpisodeIds).toHaveLength(0);
      expect(state.coinShopModalOpen).toBe(true);
    });

    it('does not charge twice for an already unlocked episode', async () => {
      const episode = makeEpisode();
      await useWalletStore.getState().unlockEpisode(episode);
      await useWalletStore.getState().unlockEpisode(episode);
      expect(useWalletStore.getState().coins).toBe(50);
    });
  });

  describe('purchases in local demo mode', () => {
    it('credits the selected pack without calling Stripe', async () => {
      await useWalletStore.getState().purchaseCoins('coins_150');
      expect(useWalletStore.getState().coins).toBe(210);
      expect(useWalletStore.getState().transactions[0]).toMatchObject({ type: 'purchase', amount: 150 });
      expect(api.createCheckout).not.toHaveBeenCalled();
    });
  });

  describe('when signed in (server wallet)', () => {
    const USER = 'u1';
    const assign = vi.fn();

    beforeEach(async () => {
      vi.stubGlobal('location', { ...window.location, assign });
      assign.mockClear();
      api.fetchWallet.mockResolvedValue({ balance: 40, transactions: [], unlockedEpisodeIds: ['ep-remote'] });
      await useWalletStore.getState().loadRemote(USER);
    });

    it('loads balance and unlocks from the server, ignoring local data', () => {
      localStorage.setItem('lamina_coins', '9999');
      const state = useWalletStore.getState();
      expect(state.coins).toBe(40);
      expect(state.isEpisodeAccessible(makeEpisode({ id: 'ep-remote' }))).toBe(true);
    });

    it('unlocks through the unlock_episode RPC', async () => {
      api.unlockEpisodeRemote.mockResolvedValue({ status: 'unlocked', balance: 30 });
      api.fetchWallet.mockResolvedValue({ balance: 30, transactions: [], unlockedEpisodeIds: ['ep-remote', 'ep-test-1'] });
      expect(await useWalletStore.getState().unlockEpisode(makeEpisode())).toBe(true);
      expect(api.unlockEpisodeRemote).toHaveBeenCalledWith('ep-test-1');
      expect(useWalletStore.getState().coins).toBe(30);
      expect(useWalletStore.getState().unlockedEpisodeIds).toContain('ep-test-1');
      expect(localStorage.getItem('lamina_coins')).toBeNull();
    });

    it('opens the shop when the server reports insufficient funds', async () => {
      api.unlockEpisodeRemote.mockResolvedValue({ status: 'insufficient_funds', balance: 3 });
      expect(await useWalletStore.getState().unlockEpisode(makeEpisode())).toBe(false);
      expect(useWalletStore.getState()).toMatchObject({ coins: 3, coinShopModalOpen: true, paymentPending: false });
    });

    it('shows an error when the unlock request fails', async () => {
      api.unlockEpisodeRemote.mockRejectedValue(new Error('sin conexión'));
      expect(await useWalletStore.getState().unlockEpisode(makeEpisode())).toBe(false);
      expect(useWalletStore.getState()).toMatchObject({ paymentError: 'sin conexión', paymentPending: false });
    });

    it('redirects to Stripe Checkout for coin packs and VIP', async () => {
      api.createCheckout.mockResolvedValue('https://checkout.stripe.test/abc');
      await useWalletStore.getState().purchaseCoins('coins_400');
      expect(api.createCheckout).toHaveBeenCalledWith('coins_400');
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/abc');
      expect(useWalletStore.getState().coins).toBe(40); // credited later by the webhook

      await useWalletStore.getState().purchaseVip();
      expect(api.createCheckout).toHaveBeenLastCalledWith('vip_monthly');
    });

    it('surfaces checkout errors', async () => {
      api.createCheckout.mockRejectedValue(new Error('Los pagos no están configurados en este servidor.'));
      await useWalletStore.getState().purchaseCoins('coins_50');
      expect(assign).not.toHaveBeenCalled();
      expect(useWalletStore.getState().paymentError).toMatch(/no están configurados/);
    });
  });
});
