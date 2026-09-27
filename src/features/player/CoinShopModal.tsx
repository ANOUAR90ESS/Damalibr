import React, { useState } from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { Coins, Check, Sparkles, X } from 'lucide-react';

export const CoinShopModal: React.FC = () => {
  const { coinShopModalOpen, closeCoinShopModal, purchaseCoins, coins } = useWalletStore();
  const [selectedPackIndex, setSelectedPackIndex] = useState(1);

  if (!coinShopModalOpen) return null;

  const packs = [
    { coins: 50, priceEur: 1.99, tag: 'Básico', popular: false },
    { coins: 150, priceEur: 4.99, tag: 'Más Popular (+25% gratis)', popular: true },
    { coins: 400, priceEur: 9.99, tag: 'Mejor Valor (+60% gratis)', popular: false },
  ];

  const handleBuy = () => {
    const pack = packs[selectedPackIndex];
    purchaseCoins(pack.coins, pack.priceEur);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeCoinShopModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 mb-2">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="font-display text-lg font-bold text-slate-100">
            Tienda de Monedas Lámina
          </h3>
          <p className="text-xs text-slate-400">
            Saldo actual: <strong className="text-amber-400 font-mono">{coins} monedas</strong>
          </p>
        </div>

        {/* Packs list */}
        <div className="space-y-2.5">
          {packs.map((pack, idx) => (
            <button
              key={pack.coins}
              onClick={() => setSelectedPackIndex(idx)}
              className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                selectedPackIndex === idx
                  ? 'bg-amber-500/10 border-amber-500/60 shadow-md shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                  selectedPackIndex === idx ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}>
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 font-mono text-base">{pack.coins} monedas</span>
                    {pack.popular && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                        Popular
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">{pack.tag}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-bold text-sm text-amber-400 font-mono">{pack.priceEur.toFixed(2)} €</span>
                {selectedPackIndex === idx && (
                  <div className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center ml-auto mt-1">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleBuy}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Comprar {packs[selectedPackIndex].coins} monedas ({packs[selectedPackIndex].priceEur.toFixed(2)} €)</span>
        </button>

        <p className="text-[10px] text-center text-slate-500">
          Pagos seguros procesados en la web y sincronizados con tu cuenta.
        </p>
      </div>
    </div>
  );
};
