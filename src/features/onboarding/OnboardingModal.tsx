import React, { useState } from 'react';
import { 
  Clapperboard, Sparkles, Film, ArrowRight, ShieldCheck, 
  Smartphone, Volume2, CheckCircle2, ChevronRight, X 
} from 'lucide-react';
import { storageService } from '../../lib/supabase';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [slide, setSlide] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      badge: 'BIENVENIDO A LÁMINA',
      title: 'Los Grandes Clásicos, Reinvención Vertical',
      subtitle: 'Don Quijote, La Celestina, La Regenta y las cumbres de la literatura en dominio público cobran vida en tu mano.',
      icon: Sparkles,
      iconColor: 'from-amber-500 to-orange-500 text-slate-950',
      features: [
        'Producción adaptada de 1 a 3 minutos por episodio',
        'Primeros 5 episodios de cada obra 100% gratuitos',
        'Sinopsis literarias y contexto cultural riguroso'
      ],
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80'
    },
    {
      badge: '3 FORMATOS SINCRONIZADOS',
      title: 'Una Misma Obra, Tres Maneras de Sentirla',
      subtitle: 'Cambia entre formatos al instante: el reproductor salta a la posición exacta de la historia sin perder el hilo.',
      icon: Clapperboard,
      iconColor: 'from-purple-600 to-amber-500 text-white',
      features: [
        '📱 Microdrama Vertical 9:16: Diálogos intensos y cliffhangers adictivos',
        '🎬 Cortometraje 16:9: Experiencia cinematográfica completa',
        '✨ Video-Resumen 9:16: Tesis, símbolos y trama en 5-10 minutos'
      ],
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'
    },
    {
      badge: 'EXPERIENCIA MÓVIL TOTAL',
      title: 'Donde Quieras, Como Quieras',
      subtitle: 'Diseñado primero para móvil con feeds de swipe vertical, descargas offline y calidad HD.',
      icon: Smartphone,
      iconColor: 'from-emerald-500 to-teal-500 text-slate-950',
      features: [
        'Descargas locales offline (empaquetable con Capacitor)',
        'Voces actorales con modulación de emoción y subtítulos',
        'Modo Infantil seguro con protección por PIN'
      ],
      image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80'
    }
  ];

  const current = slides[slide];
  const Icon = current.icon;

  const handleNext = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      storageService.set('onboarding_completed', true);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            storageService.set('onboarding_completed', true);
            onClose();
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top visual graphic with preview backdrop */}
        <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
          <img 
            src={current.image} 
            alt={current.title} 
            className="w-full h-full object-cover filter brightness-75 transition-all duration-500 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/40" />
          
          <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl bg-gradient-to-tr ${current.iconColor} flex items-center justify-center shadow-xl`}>
            <Icon className="w-7 h-7" />
          </div>
        </div>

        {/* Content */}
        <div className="pt-2 space-y-1.5">
          <span className="text-[10px] font-bold text-amber-400 tracking-widest uppercase">
            {current.badge}
          </span>
          <h2 className="font-display text-lg font-black text-slate-100 leading-tight">
            {current.title}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {current.subtitle}
          </p>
        </div>

        {/* Feature bullets */}
        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-850 space-y-2 text-left">
          {current.features.map((feat, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* Slide Indicator Dots */}
        <div className="flex justify-center items-center gap-1.5 pt-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all ${
                slide === i ? 'w-6 bg-amber-400' : 'w-1.5 bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Next / Start Button */}
        <button
          onClick={handleNext}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
        >
          <span>{slide === slides.length - 1 ? '¡Comenzar la Experiencia!' : 'Continuar'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
