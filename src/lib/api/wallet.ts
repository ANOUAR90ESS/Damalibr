import { supabase } from '../supabase';
import { Transaction } from '../../types';
import type { ProductId } from '../products';
import { apiRequest } from './http';

export interface RemoteWallet {
  balance: number;
  transactions: Transaction[];
  unlockedEpisodeIds: string[];
}

export type UnlockStatus = 'unlocked' | 'already_accessible' | 'insufficient_funds';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

export async function fetchWallet(userId: string): Promise<RemoteWallet> {
  const db = client();
  const [wallet, transactions, unlocks] = await Promise.all([
    db.from('coin_wallet').select('balance').eq('user_id', userId).maybeSingle(),
    db.from('transactions').select('id, user_id, type, amount, description, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    db.from('unlocked_episodes').select('episode_id').eq('user_id', userId),
  ]);
  const error = wallet.error || transactions.error || unlocks.error;
  if (error) throw error;

  return {
    balance: wallet.data?.balance ?? 0,
    transactions: (transactions.data || []) as Transaction[],
    unlockedEpisodeIds: (unlocks.data || []).map(u => u.episode_id as string),
  };
}

export async function unlockEpisodeRemote(episodeId: string): Promise<{ status: UnlockStatus; balance: number }> {
  const { data, error } = await client().rpc('unlock_episode', { p_episode_id: episodeId });
  if (error) throw error;
  return data as { status: UnlockStatus; balance: number };
}

async function postForUrl(path: string, body: object): Promise<string> {
  const { url } = await apiRequest<{ url?: string }>(path, { method: 'POST', body, requireAuth: true });
  if (!url) throw new Error('No se pudo conectar con el servicio de pagos.');
  return url;
}

// Returns the Stripe Checkout URL for the product; the caller redirects to it.
export const createCheckout = (productId: ProductId) => postForUrl('/api/checkout', { productId });

// Returns the Stripe customer portal URL (cancel VIP, update card, invoices).
export const createBillingPortal = () => postForUrl('/api/billing-portal', {});
