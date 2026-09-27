import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SEED_BOOKS, SEED_CHARACTERS, SEED_ADAPTATIONS, SEED_EPISODES } from '../../data/seedBooks';
import { BookFormat } from '../../types';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { 
  ArrowLeft, Play, Bookmark, Download, Star, Clock, 
  Lock, Check, Clapperboard, Film, Sparkles, Volume2 
} from 'lucide-react';

export const BookDetailScreen: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { playEpisode } = usePlayerStore();
  const { items, progress, toggleBookmark, downloadEpisodeOffline, isBookDownloaded } = useLibraryStore();
  const { isEpisodeAccessible, openUnlockModal } = useWalletStore();

  const [selectedFormat, setSelectedFormat] = useState<BookFormat>('drama');

  const book = SEED_BOOKS.find(b => b.id === bookId) || SEED_BOOKS[0];
  const characters = SEED_CHARACTERS[book.id] || [];
  const adaptations = SEED_ADAPTATIONS[book.id] || [];

  const currentAdaptation = adaptations.find(a => a.format === selectedFormat) || adaptations[0];
  const episodes = currentAdaptation ? (SEED_EPISODES[currentAdaptation.id] || []) : [];

  const isBookmarked = items[book.id]?.is_bookmarked;
  const isDownloaded = isBookDownloaded(book.id);

  // Find latest progress
  const bookProgressList = Object.values(progress).filter(p => p.book_id === book.id);
  const latestProgress = bookProgressList.length ? bookProgressList[0] : null;

  const handlePlayFirst = () => {
    if (!currentAdaptation || !episodes.length) return;
    const firstEp = episodes[0];
    if (isEpisodeAccessible(firstEp)) {
      playEpisode(book, currentAdaptation, firstEp, 0);
    } else {
      openUnlockModal(firstEp);
    }
  };

  const handlePlayEpisode = (ep: typeof episodes[0]) => {
    if (!currentAdaptation) return;
    if (isEpisodeAccessible(ep)) {
      playEpisode(book, currentAdaptation, ep, 0);
    } else {
      openUnlockModal(ep);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      {/* Top Header Floating Back button */}
      <div className="fixed top-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto shadow-lg transition-transform active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => toggleBookmark(book.id)}
            className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
              isBookmarked ? 'bg-amber-500 text-slate-950' : 'bg-slate-900/80 text-white hover:text-amber-400'
            }`}
          >
            <Bookmark className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => downloadEpisodeOffline(book.id, episodes[0]?.id || 'ep-1')}
            className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
              isDownloaded ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900/80 text-white hover:text-emerald-400'
            }`}
            title={isDownloaded ? 'Descargado offline' : 'Descargar para ver sin conexión'}
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hero Backdrop & Book Cover */}
      <div className="relative w-full h-80 sm:h-96 overflow-hidden">
        <img 
          src={book.backdrop_url} 
          alt={book.title} 
          className="w-full h-full object-cover filter brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/60 to-transparent" />

        {/* Floating Book Cover & Key Meta */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4">
          <div className="w-24 sm:w-32 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/80 shrink-0 bg-slate-900">
            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
          </div>

          <div className="space-y-1 pb-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[10px]">
                {book.era}
              </span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> {book.rating}
              </span>
            </div>

            <h1 className="font-display text-xl sm:text-2xl font-black text-white leading-tight">
              {book.title}
            </h1>

            <p className="text-xs text-slate-300 font-medium">
              {book.author} · {book.year}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 space-y-6 pt-3">
        {/* Quick CTA Actions */}
        <div className="flex gap-3">
          <button
            onClick={handlePlayFirst}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{latestProgress ? 'Continuar viendo' : 'Empezar a ver'}</span>
          </button>
        </div>

        {/* Synopsis */}
        <div className="space-y-1.5">
          <h3 className="font-display text-sm font-bold text-slate-200">
            Sinopsis de la obra
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {book.synopsis}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {book.genres.map(g => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300">
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Cast of Characters */}
        <div className="space-y-2.5">
          <h3 className="font-display text-sm font-bold text-slate-200">
            Reparto y Voces de IA
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {characters.map(char => (
              <div 
                key={char.id}
                className="w-32 shrink-0 p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-1.5"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden mx-auto border-2 border-amber-500/30">
                  <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-100 truncate">{char.name}</h4>
                  <span className="text-[10px] text-amber-400 font-medium capitalize block">{char.role}</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                  <Volume2 className="w-2.5 h-2.5 text-amber-400" />
                  <span className="truncate">{char.voice_name.split(' ')[0]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Format Selector Cards */}
        <div className="space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-200">
            Elige tu formato de visionado
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'drama', name: 'Microdrama', ratio: '9:16', icon: Clapperboard, note: '1-3 min/ep' },
              { id: 'film', name: 'Cortometraje', ratio: '16:9', icon: Film, note: '10-20 min' },
              { id: 'summary', name: 'Resumen', ratio: '9:16', icon: Sparkles, note: '5-10 min' },
            ].map(f => {
              const Icon = f.icon;
              const isSelected = selectedFormat === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id as BookFormat)}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="font-bold text-xs">{f.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{f.ratio}</span>
                  <span className="text-[9px] text-slate-500">{f.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Episodes List / Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-200">
              Episodios ({episodes.length})
            </h3>
            <span className="text-xs text-slate-400">
              {selectedFormat === 'drama' ? 'Primeros 5 episodios gratis' : 'Acceso completo'}
            </span>
          </div>

          <div className="space-y-2.5">
            {episodes.map((ep) => {
              const isAccessible = isEpisodeAccessible(ep);
              const epProgress = progress[`${book.id}_${currentAdaptation.id}_${ep.id}`];

              return (
                <div
                  key={ep.id}
                  onClick={() => handlePlayEpisode(ep)}
                  className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-3 cursor-pointer group"
                >
                  {/* Thumbnail with lock overlay */}
                  <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-slate-950 shrink-0">
                    <img src={ep.thumbnail_url || book.cover_url} alt={ep.title} className="w-full h-full object-cover" />
                    
                    {!isAccessible ? (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-amber-400">
                        <Lock className="w-4 h-4" />
                        <span className="text-[9px] font-mono font-bold mt-0.5">{ep.coin_price}</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                        <Play className="w-4 h-4 fill-white text-white opacity-80 group-hover:opacity-100" />
                      </div>
                    )}

                    {/* Progress bar */}
                    {epProgress && epProgress.seconds > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                        <div 
                          className="h-full bg-amber-500" 
                          style={{ width: `${Math.min(100, (epProgress.seconds / ep.duration) * 100)}%` }} 
                        />
                      </div>
                    )}
                  </div>

                  {/* Episode details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-100 truncate pr-2">
                        {currentAdaptation.format === 'drama' ? `${ep.number}. ` : ''}
                        {ep.title}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {Math.floor(ep.duration / 60)}:{(Math.floor(ep.duration % 60)).toString().padStart(2, '0')}
                      </span>
                    </div>

                    {ep.cliffhanger && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                        "{ep.cliffhanger}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1 text-[10px]">
                      {isAccessible ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <Check className="w-3 h-3" /> Desbloqueado
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">
                          Desbloquear ({ep.coin_price} monedas)
                        </span>
                      )}
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400 font-mono">
                        Arco: {Math.round(ep.story_position_start * 100)}%–{Math.round(ep.story_position_end * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
