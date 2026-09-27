import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Crown, Sparkles, Baby, Search } from 'lucide-react';
import { useWalletStore } from '../../stores/useWalletStore';
import { useAuthStore } from '../../stores/useAuthStore';

interface TopNavBarProps {
  onSearchClick?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ onSearchClick }) => {
  const navigate = useNavigate();
  const { coins, openCoinShopModal, openVipModal } = useWalletStore();
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 w-full bg-[#090a0f]/90 backdrop-blur-md border-b border-slate-800/80 px-4 pt-safe-bar pb-3 flex items-center justify-between">
      {/* Brand Zone */}
      <button 
        onClick={() => navigate('/')} 
        className="flex items-center gap-2 group text-left transition-transform active:scale-95"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
        </div>
        <div>
          <span className="font-display font-extrabold text-xl tracking-wider bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
            LÁMINA
          </span>
          <span className="hidden sm:inline-block ml-2 text-[10px] text-amber-500/80 tracking-widest font-semibold uppercase">
            Microdramas
          </span>
        </div>
      </button>

      {/* Right Action Zone */}
      <div className="flex items-center gap-2">
        {/* Kids Mode active badge */}
        {user.kids_mode_enabled && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Baby className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kids</span>
          </div>
        )}

        {/* Search button */}
        <button 
          onClick={onSearchClick || (() => navigate('/categories'))}
          aria-label="Buscar libros"
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-full transition-colors active:scale-95"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Coins Badge / Button */}
        <button
          onClick={openCoinShopModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all active:scale-95"
          title="Tus monedas disponibles"
        >
          <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
          <span className="tabular-nums font-mono">{coins}</span>
          <span className="text-[10px] opacity-70 ml-0.5">+</span>
        </button>

        {/* VIP Subscription Badge / Action */}
        {user.is_vip ? (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold shadow-sm shadow-amber-500/10">
            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-[11px] tracking-wide">VIP</span>
          </div>
        ) : (
          <button
            onClick={openVipModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-purple-900/30 transition-all active:scale-95"
          >
            <Crown className="w-3 h-3 text-amber-200" />
            <span className="text-[11px]">VIP</span>
          </button>
        )}
      </div>
    </header>
  );
};
