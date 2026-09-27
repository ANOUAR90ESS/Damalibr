import React from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { Play, Pause, X, Maximize2 } from 'lucide-react';

export const MiniPlayer: React.FC = () => {
  const { 
    currentBook, 
    currentEpisode, 
    isPlaying, 
    togglePlay, 
    toggleMiniPlayer, 
    closePlayer, 
    isOpen, 
    isMiniPlayer, 
    currentTime, 
    duration 
  } = usePlayerStore();

  if (!isOpen || !isMiniPlayer || !currentBook || !currentEpisode) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-16 left-2 right-2 sm:left-auto sm:right-6 sm:w-96 z-40 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
      {/* Micro progress line on top */}
      <div className="absolute top-0 left-3 right-3 h-0.5 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center gap-2.5">
        {/* Thumbnail with tap to expand */}
        <button
          onClick={() => toggleMiniPlayer(false)}
          className="relative w-12 h-14 rounded-xl overflow-hidden bg-slate-800 shrink-0 group"
          title="Ampliar reproductor"
        >
          <img 
            src={currentEpisode.thumbnail_url || currentBook.cover_url} 
            alt={currentEpisode.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
            <Maximize2 className="w-3.5 h-3.5 text-white/90 drop-shadow" />
          </div>
        </button>

        {/* Info with tap to expand */}
        <button
          onClick={() => toggleMiniPlayer(false)}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block truncate">
            {currentBook.title}
          </span>
          <p className="text-xs font-bold text-slate-100 truncate">
            Ep. {currentEpisode.number}: {currentEpisode.title}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
            <span className="uppercase">{currentEpisode.format}</span>
            <span>·</span>
            <span className="font-mono">{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
          </div>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 active:scale-95 transition-transform"
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950 ml-0.5" />}
          </button>

          <button
            onClick={closePlayer}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
            aria-label="Cerrar reproductor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
