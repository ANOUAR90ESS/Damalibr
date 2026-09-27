import { create } from 'zustand';
import { storageService } from '../lib/supabase';
import { Transaction, Episode } from '../types';
import confetti from 'canvas-confetti';
import { useAuthStore } from './useAuthStore';

interface WalletState {
  coins: number;
  unlockedEpisodeIds: string[];
  transactions: Transaction[];
  unlockModalEpisode: Episode | null;
  vipModalOpen: boolean;
  coinShopModalOpen: boolean;

  // Actions
  isEpisodeAccessible: (episode: Episode) => boolean;
  unlockEpisode: (episode: Episode) => boolean;
  openUnlockModal: (episode: Episode) => void;
  closeUnlockModal: () => void;
  openVipModal: () => void;
  closeVipModal: () => void;
  openCoinShopModal: () => void;
  closeCoinShopModal: () => void;
  purchaseCoins: (amount: number, priceEur: number) => void;
  purchaseVip: () => void;
  cancelVip: () => void;
}

const DEFAULT_COINS = 60; // Welcome gift of 60 coins!

export const useWalletStore = create<WalletState>((set, get) => ({
  coins: storageService.get<number>('coins', DEFAULT_COINS),
  unlockedEpisodeIds: storageService.get<string[]>('unlocked_episodes', ['ep-q-1', 'ep-q-2', 'ep-q-3', 'ep-q-4', 'ep-q-5', 'ep-c-1', 'ep-c-2', 'ep-r-1']),
  transactions: storageService.get<Transaction[]>('transactions', [
    {
      id: 'tx-welcome',
      user_id: 'usr-lamina-demo',
      type: 'reward',
      amount: 60,
      description: 'Bono de bienvenida Lámina (60 monedas gratis)',
      created_at: new Date().toISOString(),
    }
  ]),
  unlockModalEpisode: null,
  vipModalOpen: false,
  coinShopModalOpen: false,

  isEpisodeAccessible: (episode: Episode) => {
    // 1. VIP users have access to everything
    const user = useAuthStore.getState().user;
    if (user.is_vip) return true;

    // 2. Free episodes (first 5 of drama, or marked free)
    if (episode.is_free || episode.coin_price === 0) return true;

    // 3. Summaries are free as specified in the prompt ("summaries free")
    if (episode.format === 'summary') return true;

    // 4. Check if already unlocked
    return get().unlockedEpisodeIds.includes(episode.id);
  },

  unlockEpisode: (episode: Episode) => {
    const { coins, unlockedEpisodeIds, transactions } = get();

    if (get().isEpisodeAccessible(episode)) return true;

    if (coins < episode.coin_price) {
      // Open shop or VIP modal if insufficient coins
      set({ coinShopModalOpen: true });
      return false;
    }

    const newCoins = coins - episode.coin_price;
    const newUnlocked = [...unlockedEpisodeIds, episode.id];
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      user_id: 'usr-lamina-demo',
      type: 'spend',
      amount: -episode.coin_price,
      description: `Desbloqueo de "${episode.title}" (${episode.coin_price} monedas)`,
      created_at: new Date().toISOString(),
    };

    storageService.set('coins', newCoins);
    storageService.set('unlocked_episodes', newUnlocked);
    storageService.set('transactions', [newTx, ...transactions]);

    set({
      coins: newCoins,
      unlockedEpisodeIds: newUnlocked,
      transactions: [newTx, ...transactions],
      unlockModalEpisode: null,
    });

    // Celebrate with confetti!
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#f59e0b', '#d97706', '#fbbf24', '#ffffff']
      });
    } catch {
      // Canvas confetti may be skipped if headless
    }

    return true;
  },

  openUnlockModal: (episode: Episode) => set({ unlockModalEpisode: episode }),
  closeUnlockModal: () => set({ unlockModalEpisode: null }),

  openVipModal: () => set({ vipModalOpen: true }),
  closeVipModal: () => set({ vipModalOpen: false }),

  openCoinShopModal: () => set({ coinShopModalOpen: true }),
  closeCoinShopModal: () => set({ coinShopModalOpen: false }),

  purchaseCoins: (amount: number, priceEur: number) => {
    const { coins, transactions } = get();
    const newCoins = coins + amount;
    const newTx: Transaction = {
      id: `tx-buy-${Date.now()}`,
      user_id: 'usr-lamina-demo',
      type: 'purchase',
      amount: amount,
      description: `Compra de ${amount} monedas (+${priceEur.toFixed(2)} €)`,
      created_at: new Date().toISOString(),
    };

    storageService.set('coins', newCoins);
    storageService.set('transactions', [newTx, ...transactions]);

    set({
      coins: newCoins,
      transactions: [newTx, ...transactions],
      coinShopModalOpen: false,
    });

    try {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    } catch {}
  },

  purchaseVip: () => {
    useAuthStore.getState().setVipStatus(true);
    set({ vipModalOpen: false });

    try {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#e11d48', '#f59e0b', '#8b5cf6', '#ffffff']
      });
    } catch {}
  },

  cancelVip: () => {
    useAuthStore.getState().setVipStatus(false);
  }
}));
