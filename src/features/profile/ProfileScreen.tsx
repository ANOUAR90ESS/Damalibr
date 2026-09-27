import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { TopNavBar } from '../navigation/TopNavBar';
import { 
  Flame, Target, Clock, CheckCircle, Coins, Crown, 
  Baby, Globe, LogIn, LogOut, Shield, KeyRound, Sparkles, X 
} from 'lucide-react';

export const ProfileScreen: React.FC = () => {
  const { 
    user, 
    isAuthenticated, 
    loginWithEmail, 
    loginWithGoogle, 
    logout,
    toggleKidsMode,
    setLanguage,
    kidsPinModalOpen,
    closeKidsPinVerification,
    verifyKidsPin,
    pendingKidsPinAction,
  } = useAuthStore();

  const { coins, openCoinShopModal, openVipModal, transactions } = useWalletStore();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyKidsPin(pinInput)) {
      setPinError(false);
      setPinInput('');
      closeKidsPinVerification();
      if (pendingKidsPinAction) pendingKidsPinAction();
    } else {
      setPinError(true);
    }
  };

  const handleEmailAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) return;
    loginWithEmail(authEmail, authName);
    setAuthModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <TopNavBar />

      <div className="px-4 space-y-6 pt-3">
        {/* User Card */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 border-2 border-amber-500/40">
              <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
              {user.is_vip && (
                <div className="absolute top-0 right-0 p-1 bg-amber-500 text-slate-950 rounded-bl-lg">
                  <Crown className="w-3 h-3 fill-slate-950" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-base text-slate-100">{user.display_name}</h2>
                {user.is_vip && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    VIP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{user.email}</p>
              {user.kids_mode_enabled && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium mt-1">
                  <Baby className="w-3 h-3" /> Modo Infantil Activo
                </span>
              )}
            </div>
          </div>

          <div>
            {isAuthenticated ? (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cuenta
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold shadow-lg"
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>

        {/* Goals & Streaks Gamification Banner */}
        <div className="grid grid-cols-2 gap-3">
          {/* Racha */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-950/40 to-slate-900 border border-orange-500/30 space-y-1">
            <div className="flex items-center justify-between text-orange-400">
              <span className="text-xs font-semibold">Racha de Lectura</span>
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-black text-2xl text-orange-300 font-mono">
                {user.streak_days}
              </span>
              <span className="text-xs text-slate-400 font-medium">días seguidos</span>
            </div>
            <p className="text-[10px] text-slate-400 pt-0.5">¡Estás en racha histórica!</p>
          </div>

          {/* Meta diaria */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 space-y-1">
            <div className="flex items-center justify-between text-amber-400">
              <span className="text-xs font-semibold">Meta de Hoy</span>
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-black text-2xl text-amber-300 font-mono">
                {user.minutes_watched_today} / {user.daily_goal_minutes}
              </span>
              <span className="text-xs text-slate-400 font-medium">min</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" 
                style={{ width: `${Math.min(100, (user.minutes_watched_today / user.daily_goal_minutes) * 100)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Global Stats */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Tus Estadísticas de Visionado
          </span>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-950/60">
              <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <span className="font-bold text-sm text-slate-100 font-mono block">
                {Math.floor(user.total_minutes_watched / 60)}h {user.total_minutes_watched % 60}m
              </span>
              <span className="text-[10px] text-slate-500">Tiempo total</span>
            </div>

            <div className="p-2 rounded-xl bg-slate-950/60">
              <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <span className="font-bold text-sm text-slate-100 font-mono block">
                {user.total_episodes_completed}
              </span>
              <span className="text-[10px] text-slate-500">Episodios vistos</span>
            </div>

            <div className="p-2 rounded-xl bg-slate-950/60">
              <Sparkles className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <span className="font-bold text-sm text-slate-100 font-mono block">
                5
              </span>
              <span className="text-[10px] text-slate-500">Clásicos</span>
            </div>
          </div>
        </div>

        {/* Coin Wallet Section */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">Billetera de Monedas</span>
                <span className="text-lg font-black text-amber-400 font-mono">{coins} monedas</span>
              </div>
            </div>
            <button
              onClick={openCoinShopModal}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10 active:scale-95 transition-all"
            >
              + Recargar
            </button>
          </div>

          {/* Recent transactions micro-list */}
          {transactions.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Últimos movimientos:</span>
              {transactions.slice(0, 2).map(tx => (
                <div key={tx.id} className="flex justify-between items-center text-[11px] text-slate-400">
                  <span className="truncate pr-2">{tx.description}</span>
                  <span className={`font-mono font-bold shrink-0 ${tx.amount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VIP Subscription Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-slate-900 border border-purple-500/30 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Pase Lámina VIP (9,99 €/mes)</span>
            </span>
            <p className="text-[11px] text-slate-400">
              {user.is_vip ? 'Tu suscripción está activa. Acceso ilimitado.' : 'Desbloquea todo el catálogo y calidad 1080p.'}
            </p>
          </div>
          <button
            onClick={openVipModal}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            {user.is_vip ? 'Gestionar' : 'Suscribirme'}
          </button>
        </div>

        {/* Kids Mode & Security */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Baby className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">Modo Infantil con PIN</span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Filtra clásicos con violencia o temas adultos. PIN por defecto: 1234.
              </p>
            </div>
            <button
              onClick={toggleKidsMode}
              className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                user.kids_mode_enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* Language selector */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>Idioma de los Subtítulos y Voces</span>
          </div>

          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setLanguage('es-ES')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                user.language === 'es-ES' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Español (ES)
            </button>
            <button
              onClick={() => setLanguage('es-LA')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                user.language === 'es-LA' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Español (LA)
            </button>
          </div>
        </div>

        {/* Logout button */}
        {isAuthenticated && (
          <button
            onClick={logout}
            className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        )}
      </div>

      {/* Auth Modal (Email + Google) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <h3 className="font-display text-lg font-bold text-slate-100">
                Acceso a Lámina
              </h3>
              <p className="text-xs text-slate-400">
                Sincroniza tus microdramas, monedas y progreso en cualquier dispositivo
              </p>
            </div>

            {/* Google Login Button */}
            <button
              onClick={() => { loginWithGoogle(); setAuthModalOpen(false); }}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs flex items-center justify-center gap-2.5 shadow active:scale-98 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continuar con Google</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
              <div className="flex-1 h-px bg-slate-800" />
              <span>o con tu correo</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Nombre</label>
                <input
                  type="text"
                  placeholder="Tu nombre o apodo"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Acceder a mi cuenta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Kids Mode PIN Verification Modal */}
      {kidsPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-slate-100">
                PIN de Modo Infantil
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Introduce el PIN de 4 dígitos para desactivar el filtro parental (PIN por defecto: 1234).
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input
                type="password"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                className="w-36 mx-auto text-center font-mono text-2xl tracking-widest px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 focus:outline-none focus:border-amber-400"
              />

              {pinError && (
                <p className="text-[11px] text-rose-400 font-semibold">
                  PIN incorrecto. Vuelve a intentarlo.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeKidsPinVerification}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
