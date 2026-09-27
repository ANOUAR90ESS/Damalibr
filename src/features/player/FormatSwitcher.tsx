import React from 'react';
import { BookFormat } from '../../types';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { Clapperboard, Film, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useCatalogStore } from '../../stores/useCatalogStore';

interface FormatSwitcherProps {
  onClose: () => void;
}

export const FormatSwitcher: React.FC<FormatSwitcherProps> = ({ onClose }) => {
  const { adaptationsByBook } = useCatalogStore();
  const { currentBook, currentAdaptation, switchFormat, getCurrentStoryPosition } = usePlayerStore();

  if (!currentBook || !currentAdaptation) return null;

  const currentStoryPos = getCurrentStoryPosition();
  const percentage = Math.round(currentStoryPos * 100);

  const availableAdaptations = adaptationsByBook[currentBook.id] || [];

  const formats: Array<{
    id: BookFormat;
    name: string;
    ratio: string;
    duration: string;
    description: string;
    icon: React.ElementType;
    color: string;
  }> = [
    {
      id: 'drama',
      name: 'Microdrama Vertical',
      ratio: '9:16',
      duration: '1–3 min/ep',
      description: 'Diálogos tensos entre personajes, cliffhangers y ritmo adictivo.',
      icon: Clapperboard,
      color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300',
    },
    {
      id: 'film',
      name: 'Cortometraje Cinematográfico',
      ratio: '16:9',
      duration: '10–20 min',
      description: 'Experiencia horizontal de película con ambientación y música orquestal.',
      icon: Film,
      color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/40 text-purple-300',
    },
    {
      id: 'summary',
      name: 'Video Resumen Esencial',
      ratio: '9:16',
      duration: '5–10 min',
      description: 'Las ideas clave, trama principal y contexto literario guiado por narrador.',
      icon: Sparkles,
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300',
    }
  ];

  const handleSelect = (format: BookFormat) => {
    switchFormat(format);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Cambiar Formato de Narración</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuarás exactamente al <strong className="text-amber-400">{percentage}%</strong> de la trama
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Narrative Arc Synchronizer Indicator */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
            <span>Posición de la historia:</span>
            <span className="font-mono text-amber-400 font-semibold">{percentage}% del arco narrativo</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Format Options */}
        <div className="space-y-2.5">
          {formats.map((fmt) => {
            const Icon = fmt.icon;
            const isCurrent = currentAdaptation.format === fmt.id;
            const isAvailable = availableAdaptations.some(a => a.format === fmt.id);

            return (
              <button
                key={fmt.id}
                disabled={!isAvailable}
                onClick={() => handleSelect(fmt.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 relative group ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                    : isAvailable
                      ? 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-750 hover:border-slate-600'
                      : 'opacity-40 bg-slate-950 border-slate-850 cursor-not-allowed'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${fmt.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100">{fmt.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {fmt.ratio}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {fmt.duration}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {fmt.description}
                  </p>
                </div>

                <div className="shrink-0 self-center">
                  {isCurrent ? (
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : isAvailable ? (
                    <div className="w-6 h-6 rounded-full bg-slate-800 group-hover:bg-amber-500 text-slate-400 group-hover:text-slate-950 flex items-center justify-center transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
