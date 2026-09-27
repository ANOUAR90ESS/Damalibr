import { create } from 'zustand';
import { storageService } from '../lib/supabase';
import { Transaction, Episode } from '../types';
import confetti from 'canvas-confetti';
import { useAuthStore } from './useAuthStore';
import { COIN_PACKS, CoinPack, formatEur, VIP_PLAN } from '../lib/products';
import { createBillingPortal, createCheckout, fetchWallet, unlockEpisodeRemote } from '../lib/api/wallet';
import { purchasesAvailable } from '../lib/platform';

export const NATIVE_PURCHASES_MESSAGE = 'Las compras todavía no están disponibles en la app. Tus monedas y tu VIP se sincronizan con tu cuenta.';

interface WalletState {
  coins: number;
  unlockedEpisodeIds: string[];
  transactions: Transaction[];
  unlockModalEpisode: Episode | null;
  vipModalOpen: boolean;
  coinShopModalOpen: boolean;
  /** Supabase user id when the wallet lives on the server */
  remoteUserId: string | null;
  /** true while an unlock or a redirect to Stripe is in progress */
  paymentPending: boolean;
  paymentError: string | null;

  // Actions
  isEpisodeAccessible: (episode: Episode) => boolean;
  unlockEpisode: (episode: Episode) => Promise<boolean>;
  openUnlockModal: (episode: Episode) => void;
  closeUnlockModal: () => void;
  openVipModal: () => void;
  closeVipModal: () => void;
  openCoinShopModal: () => void;
  closeCoinShopModal: () => void;
  purchaseCoins: (packId: CoinPack['id']) => Promise<void>;
  purchaseVip: () => Promise<void>;
  manageVip: () => Promise<void>;
  loadRemote: (userId: string) => Promise<void>;
  refreshRemote: () => Promise<void>;
  resetToLocal: () => void;
}

const DEFAULT_COINS = 60; // Welcome gift of 60 coins!
const LOCAL_USER_ID = 'usr-lamina-demo';

function loadLocalState() {
  return {
    coins: storageService.get<number>('coins', DEFAULT_COINS),
    unlockedEpisodeIds: storageService.get<string[]>('unlocked_episodes', ['ep-q-1', 'ep-q-2', 'ep-q-3', 'ep-q-4', 'ep-q-5', 'ep-c-1', 'ep-c-2', 'ep-r-1']),
    transactions: storageService.get<Transaction[]>('transactions', [
      {
        id: 'tx-welcome',
        user_id: LOCAL_USER_ID,
        type: 'reward',
        amount: 60,
        description: 'Bono de bienvenida Lámina (60 monedas gratis)',
        created_at: new Date().toISOString(),
      }
    ]),
  };
}

function celebrate(options: confetti.Options) {
  try {
    confetti(options);
  } catch {
    // Canvas confetti may be skipped if headless
  }
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo salió mal. Inténtalo de nuevo.');

export const useWalletStore = create<WalletState>((set, get) => {
  // Signed-in users pay through Stripe Checkout; the webhook credits the purchase.
  async function redirectToCheckout(productId: CoinPack['id'] | typeof VIP_PLAN.id) {
    // App stores require their own billing for digital goods: no Stripe inside the native app.
    if (!purchasesAvailable) {
      set({ paymentError: NATIVE_PURCHASES_MESSAGE });
      return;
    }
    set({ paymentPending: true, paymentError: null });
    try {
      window.location.assign(await createCheckout(productId));
    } catch (e) {
      set({ paymentPending: false, paymentError: errorMessage(e) });
    }
  }

  return {
    ...loadLocalState(),
    unlockModalEpisode: null,
    vipModalOpen: false,
    coinShopModalOpen: false,
    remoteUserId: null,
    paymentPending: false,
    paymentError: null,

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

    unlockEpisode: async (episode: Episode) => {
      if (get().isEpisodeAccessible(episode)) return true;

      const { remoteUserId } = get();
      if (remoteUserId) {
        if (get().paymentPending) return false;
        set({ paymentPending: true, paymentError: null });
        try {
          const { status, balance } = await unlockEpisodeRemote(episode.id);
          if (status === 'insufficient_funds') {
            set({ coins: balance, paymentPending: false, coinShopModalOpen: true });
            return false;
          }
          set(s => ({
            coins: balance,
            unlockedEpisodeIds: s.unlockedEpisodeIds.includes(episode.id) ? s.unlockedEpisodeIds : [...s.unlockedEpisodeIds, episode.id],
            unlockModalEpisode: null,
            paymentPending: false,
          }));
          if (status === 'unlocked') {
            celebrate({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#f59e0b', '#d97706', '#fbbf24', '#ffffff'] });
          }
          get().refreshRemote();
          return true;
        } catch (e) {
          set({ paymentPending: false, paymentError: errorMessage(e) });
          return false;
        }
      }

      if (useAuthStore.getState().authMode === 'supabase') {
        set({ paymentError: 'Inicia sesión para desbloquear episodios.' });
        return false;
      }

      // Local demo mode
      const { coins, unlockedEpisodeIds, transactions } = get();
      if (coins < episode.coin_price) {
        // Open shop or VIP modal if insufficient coins
        set({ coinShopModalOpen: true });
        return false;
      }

      const newCoins = coins - episode.coin_price;
      const newUnlocked = [...unlockedEpisodeIds, episode.id];
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        user_id: LOCAL_USER_ID,
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
      celebrate({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#f59e0b', '#d97706', '#fbbf24', '#ffffff'] });
      return true;
    },

    openUnlockModal: (episode: Episode) => set({ unlockModalEpisode: episode, paymentError: null }),
    closeUnlockModal: () => set({ unlockModalEpisode: null }),

    openVipModal: () => set({ vipModalOpen: true, paymentError: null }),
    closeVipModal: () => set({ vipModalOpen: false }),

    openCoinShopModal: () => set({ coinShopModalOpen: true, paymentError: null }),
    closeCoinShopModal: () => set({ coinShopModalOpen: false }),

    purchaseCoins: async (packId: CoinPack['id']) => {
      const pack = COIN_PACKS.find(p => p.id === packId);
      if (!pack) return;
      if (get().remoteUserId) return redirectToCheckout(pack.id);
      if (useAuthStore.getState().authMode === 'supabase') {
        set({ paymentError: 'Inicia sesión para comprar monedas.' });
        return;
      }

      // Local demo mode: simulated purchase
      const { coins, transactions } = get();
      const newCoins = coins + pack.coins;
      const newTx: Transaction = {
        id: `tx-buy-${Date.now()}`,
        user_id: LOCAL_USER_ID,
        type: 'purchase',
        amount: pack.coins,
        description: `Compra de ${pack.coins} monedas (${formatEur(pack.priceCents)}, demo)`,
        created_at: new Date().toISOString(),
      };

      storageService.set('coins', newCoins);
      storageService.set('transactions', [newTx, ...transactions]);

      set({
        coins: newCoins,
        transactions: [newTx, ...transactions],
        coinShopModalOpen: false,
      });

      celebrate({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    },

    purchaseVip: async () => {
      if (get().remoteUserId) return redirectToCheckout(VIP_PLAN.id);
      if (useAuthStore.getState().authMode === 'supabase') {
        set({ paymentError: 'Inicia sesión para suscribirte a VIP.' });
        return;
      }

      // Local demo mode: simulated subscription
      useAuthStore.getState().setVipStatus(true);
      set({ vipModalOpen: false });
      celebrate({ particleCount: 100, spread: 100, origin: { y: 0.5 }, colors: ['#e11d48', '#f59e0b', '#8b5cf6', '#ffffff'] });
    },

    manageVip: async () => {
      if (!get().remoteUserId) {
        // Local demo mode: cancel immediately
        useAuthStore.getState().setVipStatus(false);
        set({ vipModalOpen: false });
        return;
      }
      if (!purchasesAvailable) {
        set({ paymentError: NATIVE_PURCHASES_MESSAGE });
        return;
      }
      set({ paymentPending: true, paymentError: null });
      try {
        window.location.assign(await createBillingPortal());
      } catch (e) {
        set({ paymentPending: false, paymentError: errorMessage(e) });
      }
    },

    loadRemote: async (userId: string) => {
      set({ remoteUserId: userId, coins: 0, unlockedEpisodeIds: [], transactions: [], paymentPending: false, paymentError: null });
      await get().refreshRemote();
    },

    refreshRemote: async () => {
      const userId = get().remoteUserId;
      if (!userId) return;
      try {
        const wallet = await fetchWallet(userId);
        if (get().remoteUserId !== userId) return; // signed out meanwhile
        set({ coins: wallet.balance, transactions: wallet.transactions, unlockedEpisodeIds: wallet.unlockedEpisodeIds });
      } catch (e) {
        console.warn('No se pudo cargar la billetera', e);
      }
    },

    resetToLocal: () => set({ remoteUserId: null, paymentPending: false, paymentError: null, ...loadLocalState() }),
  };
});
