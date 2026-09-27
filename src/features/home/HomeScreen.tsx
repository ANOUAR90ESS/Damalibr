import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEED_BOOKS, SEED_ADAPTATIONS, SEED_EPISODES } from '../../data/seedBooks';
import { Book, Episode } from '../../types';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { storageService } from '../../lib/supabase';
import { TopNavBar } from '../navigation/TopNavBar';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { Play, Sparkles, Star, Clock, Bookmark, ChevronRight, HelpCircle } from 'lucide-react';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { playEpisode } = usePlayerStore();
  const { items, progress, toggleBookmark } = useLibraryStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'POPULAR' | 'NUEVO' | 'RANKING' | 'CATEGORÍAS'>('POPULAR');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return !storageService.get<boolean>('onboarding_completed', false);
  });

  // Filter books for Kids mode if active
  const filteredBooks = user.kids_mode_enabled 
    ? SEED_BOOKS.filter(b => b.kids_friendly)
    : SEED_BOOKS;

  const heroBook = filteredBooks[0] || SEED_BOOKS[0];

  // Continue watching list from library progress
  const continueWatchingItems = Object.values(items)
    .filter(item => item.state === 'started')
    .map(item => {
      const book = SEED_BOOKS.find(b => b.id === item.book_id);
      const userProg = Object.values(progress).find(p => p.book_id === item.book_id && !p.completed);
      return { book, userProg };
    })
    .filter((entry): entry is { book: Book; userProg: typeof progress[string] | undefined } => Boolean(entry.book));

  const handlePlayBookDefault = (book: Book) => {
    const adaptations = SEED_ADAPTATIONS[book.id] || [];
    const dramaAdaptation = adaptations.find(a => a.format === 'drama') || adaptations[0];
    if (!dramaAdaptation) return;

    const episodes = SEED_EPISODES[dramaAdaptation.id] || [];
    const firstEp = episodes[0];
    if (firstEp) {
      playEpisode(book, dramaAdaptation, firstEp, 0);
    } else {
      navigate(`/book/${book.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      {/* Top Navbar */}
      <TopNavBar onSearchClick={() => navigate('/categories')} />

      {/* Primary Category / Feed Navigation Tabs */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-[#090a0f]/80 backdrop-blur-md sticky top-14 z-20 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {(['POPULAR', 'NUEVO', 'RANKING', 'CATEGORÍAS'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                if (tab === 'CATEGORÍAS' || tab === 'RANKING') {
                  navigate('/categories');
                } else {
                  setActiveTab(tab);
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowOnboarding(true)}
          className="ml-2 p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-full transition-colors shrink-0"
          title="Ver Guía de Lámina (3 Formatos)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-7 pt-2">
        {/* Featured Hero Banner */}
        <section className="px-4">
          <div className="relative w-full h-[380px] sm:h-[420px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 group">
            {/* Background Image with dramatic gradient overlays */}
            <img 
              src={heroBook.backdrop_url} 
              alt={heroBook.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f]/90 via-transparent to-transparent" />

            {/* Hero Content */}
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30">
                  <Sparkles className="w-3 h-3" /> Clásico Destacado
                </span>
                <span>·</span>
                <span className="text-slate-300 font-normal">{heroBook.era}</span>
                <span>·</span>
                <span className="flex items-center gap-0.5 text-amber-300">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {heroBook.rating}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight max-w-lg">
                {heroBook.title}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 max-w-md">
                {heroBook.synopsis}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => handlePlayBookDefault(heroBook)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Ver Microdrama Gratis</span>
                </button>

                <button
                  onClick={() => navigate(`/book/${heroBook.id}`)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs sm:text-sm font-semibold backdrop-blur-md active:scale-95 transition-all"
                >
                  Ficha y Formatos
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Shelf 1: "Continuar viendo" (if any in progress) */}
        {continueWatchingItems.length > 0 && (
          <section className="space-y-3 px-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Continuar viendo</span>
              </h2>
              <button 
                onClick={() => navigate('/library')} 
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-medium"
              >
                <span>Ver todo</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {continueWatchingItems.map(({ book, userProg }) => {
                const bookAdaptations = SEED_ADAPTATIONS[book.id] || [];
                const currentAdapt = bookAdaptations.find(a => a.id === userProg?.adaptation_id) || bookAdaptations[0];
                const episodes = currentAdapt ? (SEED_EPISODES[currentAdapt.id] || []) : [];
                const currentEp = episodes.find(e => e.id === userProg?.episode_id) || episodes[0];

                return (
                  <div
                    key={book.id}
                    className="w-56 sm:w-64 bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 shrink-0 hover:border-slate-700 transition-all cursor-pointer group"
                    onClick={() => {
                      if (currentAdapt && currentEp) {
                        playEpisode(book, currentAdapt, currentEp, userProg?.seconds || 0);
                      } else {
                        navigate(`/book/${book.id}`);
                      }
                    }}
                  >
                    <div className="relative h-32 rounded-xl overflow-hidden bg-slate-950 mb-2">
                      <img 
                        src={book.backdrop_url || book.cover_url} 
                        alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                        <div className="w-9 h-9 rounded-full bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                        </div>
                      </div>
                      {/* Micro progress line */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                        <div className="h-full bg-amber-500 w-2/5" />
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">
                        {currentAdapt?.format === 'drama' ? `Episodio ${currentEp?.number || 1}` : 'Cortometraje'}
                      </span>
                      <h4 className="font-bold text-xs text-slate-100 truncate">
                        {book.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {currentEp?.title || book.author}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Shelf 2: "Microdramas Verticales en 9:16" */}
        <section className="space-y-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Microdramas Verticales (9:16)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold font-mono">
                  15-40 EPS
                </span>
              </h2>
              <p className="text-xs text-slate-400">Episodios de 1 a 3 minutos con diálogos reales y cliffhangers</p>
            </div>
            <button 
              onClick={() => navigate('/feed')} 
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-medium shrink-0"
            >
              <span>Ver Feed</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2">
            {filteredBooks.map((book) => {
              const bookAdaptations = SEED_ADAPTATIONS[book.id] || [];
              const dramaAdapt = bookAdaptations.find(a => a.format === 'drama');

              return (
                <div
                  key={book.id}
                  onClick={() => navigate(`/book/${book.id}`)}
                  className="w-36 sm:w-44 shrink-0 group cursor-pointer space-y-2"
                >
                  <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 group-hover:border-amber-500/50 transition-all shadow-lg">
                    <img 
                      src={book.cover_url} 
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                    
                    {/* Free first 5 badge */}
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow">
                      5 EPS GRATIS
                    </span>

                    {/* Bookmark quick button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleBookmark(book.id); }}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                        items[book.id]?.is_bookmarked ? 'bg-amber-500 text-slate-950' : 'bg-black/50 text-white/80 hover:text-white'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                    </button>

                    {/* Bottom overlay info */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                      <div className="flex items-center gap-1 text-[10px] text-amber-300 font-medium mb-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{dramaAdapt?.episode_count || 15} eps</span>
                      </div>
                      <h4 className="font-display font-bold text-xs line-clamp-1 leading-snug">
                        {book.title}
                      </h4>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-xs text-slate-200 line-clamp-1 group-hover:text-amber-300 transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {book.author}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Shelf 3: "Cortometrajes Cinematográficos (16:9)" */}
        <section className="space-y-3 px-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Cortometrajes Cinematográficos (16:9)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold font-mono">
                10-20 MIN
              </span>
            </h2>
            <p className="text-xs text-slate-400">Narrativa completa de la obra en una sola sesión de cine</p>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {filteredBooks.map((book) => {
              const bookAdaptations = SEED_ADAPTATIONS[book.id] || [];
              const filmAdapt = bookAdaptations.find(a => a.format === 'film');

              return (
                <div
                  key={`film-${book.id}`}
                  onClick={() => navigate(`/book/${book.id}`)}
                  className="w-64 sm:w-72 shrink-0 group cursor-pointer space-y-2"
                >
                  <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 group-hover:border-purple-500/50 transition-all shadow-lg">
                    <img 
                      src={book.backdrop_url} 
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-600/90 text-white font-bold text-[9px] uppercase tracking-wider">
                      CINE 16:9
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-xs">
                      <span className="font-semibold truncate pr-2">{book.title}</span>
                      <span className="font-mono text-[10px] text-purple-300 shrink-0">
                        {Math.floor((filmAdapt?.total_duration || 900) / 60)} min
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-xs text-slate-200 line-clamp-1">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {book.author} · {book.year}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Shelf 4: "Video Resúmenes en 10 Minutos" */}
        <section className="space-y-3 px-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Video Resúmenes Esenciales</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold font-mono">
                100% GRATIS
              </span>
            </h2>
            <p className="text-xs text-slate-400">Aprende la trama, los símbolos y las ideas clave en 5 a 10 minutos</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredBooks.slice(0, 4).map((book) => {
              const bookAdaptations = SEED_ADAPTATIONS[book.id] || [];
              const sumAdapt = bookAdaptations.find(a => a.format === 'summary');
              const sumEp = sumAdapt ? (SEED_EPISODES[sumAdapt.id] || [])[0] : null;

              return (
                <div
                  key={`sum-${book.id}`}
                  onClick={() => {
                    if (sumAdapt && sumEp) {
                      playEpisode(book, sumAdapt, sumEp, 0);
                    } else {
                      navigate(`/book/${book.id}`);
                    }
                  }}
                  className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 flex items-center gap-3 cursor-pointer group transition-all"
                >
                  <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-slate-950 shrink-0">
                    <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                        Resumen Guiado
                      </span>
                      <span className="text-[10px] text-slate-500">·</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {Math.floor((sumAdapt?.total_duration || 480) / 60)} min
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-100 truncate group-hover:text-emerald-300 transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {book.synopsis}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Onboarding Modal with stitch slides */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
};
