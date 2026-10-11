import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BellRing, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useToastStore, ToastTone } from '../../stores/useToastStore';

const TONE_STYLES: Record<ToastTone, { icon: typeof BellRing; className: string }> = {
  info: { icon: BellRing, className: 'border-amber-500/30 text-amber-400' },
  success: { icon: CheckCircle2, className: 'border-emerald-500/30 text-emerald-400' },
  error: { icon: AlertCircle, className: 'border-rose-500/40 text-rose-400' },
};

/** Global toast stack, mounted once in the app layout above every screen and modal. */
export const ToastViewport: React.FC = () => {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div
      aria-live="polite"
      className="fixed top-4 inset-x-4 z-[100] max-w-sm mx-auto flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const { icon: Icon, className } = TONE_STYLES[toast.tone];
          return (
            <motion.div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto p-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border shadow-2xl flex items-center gap-2.5 ${className}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <p className="flex-1 text-xs font-semibold text-slate-100 leading-snug">{toast.message}</p>
              <button
                onClick={() => dismissToast(toast.id)}
                aria-label="Cerrar aviso"
                className="p-1 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
