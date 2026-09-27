// Single source of truth for what can be bought. The server only trusts these
// prices (never amounts sent by the client) when creating Stripe Checkout sessions.

export type ProductId = 'coins_50' | 'coins_150' | 'coins_400' | 'vip_monthly';

export interface CoinPack {
  id: Exclude<ProductId, 'vip_monthly'>;
  kind: 'coins';
  coins: number;
  priceCents: number;
  tag: string;
  popular: boolean;
}

export interface VipPlan {
  id: 'vip_monthly';
  kind: 'vip';
  priceCents: number;
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'coins_50', kind: 'coins', coins: 50, priceCents: 199, tag: 'Básico', popular: false },
  { id: 'coins_150', kind: 'coins', coins: 150, priceCents: 499, tag: 'Más Popular (+25% gratis)', popular: true },
  { id: 'coins_400', kind: 'coins', coins: 400, priceCents: 999, tag: 'Mejor Valor (+60% gratis)', popular: false },
];

export const VIP_PLAN: VipPlan = { id: 'vip_monthly', kind: 'vip', priceCents: 999 };

export function getProduct(id: unknown): CoinPack | VipPlan | undefined {
  if (id === VIP_PLAN.id) return VIP_PLAN;
  return COIN_PACKS.find(p => p.id === id);
}

export const formatEur = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
