import React from 'react';
import { NATIVE_PURCHASES_MESSAGE, useWalletStore } from '../../stores/useWalletStore';
import { purchasesAvailable } from '../../lib/platform';
import { useAuthStore } from '../../stores/useAuthStore';
import { Crown, Check, Sparkles, X, ShieldCheck, Download, Tv } from 'lucide-react';
import { formatEur, VIP_PLAN } from '../../lib/products';

export const VipModal: React.FC = () => {
  const { vipModalOpen, closeVipModal, purchaseVip, manageVip, paymentPending, paymentError } = useWalletStore();
  const { user, authMode } = useAuthStore();
  // Real accounts inside the native app cannot buy through Stripe (store billing rules).
  const storeBlocked = !purchasesAvailable && authMode === 'supabase';

  if (!vipModalOpen) return null;

  const benefits = [
    { icon: Crown, text: 'Acceso total a todos los microdramas y cortometrajes sin monedas' },
    { icon: Tv, text: 'Máxima calidad Ultra HD 1080p con audio cinematográfico' },
    { icon: Download, text: 'Descargas offline ilimitadas para ver sin conexión' },
    { icon: Sparkles, text: 'Estrenos semanales exclusivos y acceso anticipado al pipeline de IA' },
    { icon: ShieldCheck, text: 'Experiencia ininterrumpida sin anuncios' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-gradient-to-b from-purple-950/70 via-slate-900 to-slate-950 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeVipModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Crown & Badge */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-amber-500 flex items-center justify-center mx-auto text-amber-200 shadow-xl shadow-purple-600/30 mb-2">
            <Crown className="w-8 h-8 fill-amber-200" />
          </div>
          <span className="text-[11px] font-bold tracking-widest text-amber-400 uppercase">
            Pase Lámina VIP
          </span>
          <h3 className="font-display text-xl font-bold text-slate-100">
            La Experiencia Definitiva
          </h3>
          <div className="pt-1">
            <span className="text-2xl font-black text-amber-300 font-mono">9,99 €</span>
            <span className="text-xs text-slate-400 ml-1">/ mes</span>
          </div>
        </div>

        {/* Benefits list */}
        <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-purple-500/20">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                <div className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span>{b.text}</span>
              </div>
            );
          })}
        </div>

        {storeBlocked && (
          <p className="text-[11px] text-center font-semibold text-slate-300 bg-slate-800/80 rounded-xl p-2.5">
            {NATIVE_PURCHASES_MESSAGE}
          </p>
        )}

        {/* Purchase CTA */}
        {user.is_vip ? (
          <div className="space-y-2">
            <div className="text-center p-3 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold">
              ✓ Tu suscripción VIP está activa. ¡Disfruta de todo el catálogo!
            </div>
            <button
              onClick={manageVip}
              disabled={paymentPending}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 text-xs font-semibold transition-colors"
            >
              {paymentPending ? 'Abriendo…' : 'Gestionar o cancelar suscripción'}
            </button>
          </div>
        ) : (
          <button
            onClick={purchaseVip}
            disabled={paymentPending || storeBlocked}
            className="w-full disabled:opacity-60 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 active:scale-98 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{paymentPending ? 'Redirigiendo al pago seguro…' : `Suscribirme por ${formatEur(VIP_PLAN.priceCents)}/mes`}</span>
          </button>
        )}

        {paymentError && (
          <p role="alert" className="text-[11px] text-center font-semibold text-rose-400">
            {paymentError}
          </p>
        )}

        <p className="text-[10px] text-center text-slate-500">
          Cancela en cualquier momento desde tu perfil. Sin compromisos.
        </p>
      </div>
    </div>
  );
};
