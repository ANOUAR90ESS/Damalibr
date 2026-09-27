import React from 'react';
import { useWalletStore } from '../../stores/useWalletStore';
import { Coins, Crown, Lock, Sparkles } from 'lucide-react';

export const UnlockModal: React.FC = () => {
  const { 
    unlockModalEpisode, 
    closeUnlockModal, 
    coins, 
    unlockEpisode, 
    openCoinShopModal, 
    openVipModal 
  } = useWalletStore();

  if (!unlockModalEpisode) return null;

  const cost = unlockModalEpisode.coin_price || 10;
  const hasEnoughCoins = coins >= cost;

  const handleUnlock = () => {
    const success = unlockEpisode(unlockModalEpisode);
    if (success) {
      closeUnlockModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
          <Lock className="w-7 h-7" />
        </div>

        {/* Title & Info */}
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold text-slate-100">
            Desbloquear Episodio
          </h3>
          <p className="text-sm font-semibold text-amber-300">
            Ep. {unlockModalEpisode.number}: {unlockModalEpisode.title}
          </p>
          {unlockModalEpisode.cliffhanger && (
            <p className="text-xs text-slate-400 italic pt-1 line-clamp-2">
              "{unlockModalEpisode.cliffhanger}"
            </p>
          )}
        </div>

        {/* Balance status */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Tus monedas:</span>
          </div>
          <span className="font-mono font-bold text-sm text-amber-400">{coins}</span>
        </div>

        {/* Primary Action Button */}
        {hasEnoughCoins ? (
          <button
            onClick={handleUnlock}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
          >
            <Coins className="w-4 h-4" />
            <span>Desbloquear por {cost} monedas</span>
          </button>
        ) : (
          <button
            onClick={() => { closeUnlockModal(); openCoinShopModal(); }}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
          >
            <Coins className="w-4 h-4" />
            <span>Necesitas {cost - coins} monedas más (Comprar)</span>
          </button>
        )}

        {/* VIP Alternative Option */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={() => { closeUnlockModal(); openVipModal(); }}
            className="w-full py-2.5 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>O disfruta acceso ilimitado con Pase VIP</span>
          </button>
        </div>

        {/* Cancel button */}
        <button
          onClick={closeUnlockModal}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors block mx-auto"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
