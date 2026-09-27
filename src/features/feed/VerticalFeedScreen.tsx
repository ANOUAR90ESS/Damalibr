import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogStore } from '../../stores/useCatalogStore';
import { Episode, Book, Adaptation, ScriptLine } from '../../types';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { 
  Heart, Bookmark, Share2, MessageSquare, Play, Pause, 
  Volume2, VolumeX, Maximize2, AlertCircle, ChevronUp, ChevronDown 
} from 'lucide-react';

interface FeedItem {
  book: Book;
  adaptation: Adaptation;
  episode: Episode;
}

export const VerticalFeedScreen: React.FC = () => {
  const { books, adaptationsByBook, episodesByAdaptation } = useCatalogStore();
  const navigate = useNavigate();
  const { playEpisode } = usePlayerStore();
  const { items, toggleBookmark } = useLibraryStore();
  const { isEpisodeAccessible, openUnlockModal } = useWalletStore();

  // Flatten drama episodes across classics for the feed
  const feedItems = useMemo<FeedItem[]>(() => {
    const list: FeedItem[] = [];
    books.forEach(book => {
      const adaptations = adaptationsByBook[book.id] || [];
      const dramaAdapt = adaptations.find(a => a.format === 'drama');
      if (dramaAdapt) {
        const eps = episodesByAdaptation[dramaAdapt.id] || [];
        eps.forEach(ep => {
          list.push({ book, adaptation: dramaAdapt, episode: ep });
        });
      }
    });
    return list;
  }, [books, adaptationsByBook, episodesByAdaptation]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({
    'ep-q-1': 14200,
    'ep-q-2': 11850,
    'ep-q-3': 9420,
    'ep-c-1': 8910,
    'ep-r-1': 7340,
  });
  const [showShareToast, setShowShareToast] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState<ScriptLine | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef<number | null>(null);

  const currentItem = feedItems[currentIndex] || feedItems[0];
  const isLocked = currentItem ? !isEpisodeAccessible(currentItem.episode) : false;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    touchStartY.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 40) {
      if (e.deltaY > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  // Track subtitle progression while feed video plays
  useEffect(() => {
    if (!currentItem || !isPlaying) return;
    const ep = currentItem.episode;
    const scenes = ep.script_json?.scenes || [];
    if (!scenes.length) return;

    let lineIndex = 0;
    const lines = scenes.flatMap(s => s.lines);
    if (!lines.length) return;

    setActiveSubtitle(lines[0]);
    const timer = setInterval(() => {
      lineIndex = (lineIndex + 1) % lines.length;
      setActiveSubtitle(lines[lineIndex]);
    }, 4500);

    return () => clearInterval(timer);
  }, [currentIndex, isPlaying]);

  const handleNext = () => {
    if (currentIndex < feedItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') handleNext();
      if (e.key === 'ArrowUp') handlePrev();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handleLike = (epId: string) => {
    const isLiked = likedMap[epId];
    setLikedMap(prev => ({ ...prev, [epId]: !isLiked }));
    setLikeCountMap(prev => ({
      ...prev,
      [epId]: (prev[epId] || 1200) + (isLiked ? -1 : 1)
    }));
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${currentItem.book.title} - Ep. ${currentItem.episode.number}`,
        text: `Mira este microdrama literario en Lámina: ${currentItem.episode.title}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2500);
    }
  };

  const handleOpenFullPlayer = () => {
    if (isLocked) {
      openUnlockModal(currentItem.episode);
    } else {
      playEpisode(currentItem.book, currentItem.adaptation, currentItem.episode, 0);
    }
  };

  if (!currentItem) return null;

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="fixed inset-0 z-30 bg-black flex items-center justify-center overflow-hidden pb-16 select-none"
    >
      {/* Video Container (Strict 9:16 vertical ratio) */}
      <div className="relative w-full h-full max-w-md bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Background Video / Animated Canvas */}
        <div 
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          <video
            ref={videoRef}
            src={currentItem.episode.video_url}
            autoPlay
            loop
            playsInline
            muted={isMuted}
            className="w-full h-full object-cover"
          />

          {/* Fallback Animated Backdrop image with Ken Burns */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <img 
              src={currentItem.episode.thumbnail_url || currentItem.book.cover_url} 
              alt={currentItem.episode.title}
              className="w-full h-full object-cover animate-kenburns-2 filter brightness-90"
            />
          </div>

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />
        </div>

        {/* Play/Pause Center Indicator */}
        {!isPlaying && (
          <div 
            onClick={() => setIsPlaying(true)}
            className="absolute z-20 w-16 h-16 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md cursor-pointer animate-in zoom-in-75 duration-150"
          >
            <Play className="w-8 h-8 fill-white ml-1" />
          </div>
        )}

        {/* Top Floating Header */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
              Para Ti
            </span>
            <span className="text-[11px] text-slate-300 font-medium">
              {currentIndex + 1} / {feedItems.length}
            </span>
          </div>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Rail Interactive Buttons */}
        <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4 pointer-events-auto">
          {/* Book Avatar / Profile Jump */}
          <button
            onClick={() => navigate(`/book/${currentItem.book.id}`)}
            className="relative w-11 h-11 rounded-full border-2 border-amber-400 overflow-hidden shadow-lg group active:scale-90 transition-transform"
            title="Ver ficha del libro"
          >
            <img src={currentItem.book.cover_url} alt={currentItem.book.title} className="w-full h-full object-cover" />
          </button>

          {/* Like Button */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => handleLike(currentItem.episode.id)}
              className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white active:scale-125 transition-transform"
            >
              <Heart 
                className={`w-6 h-6 transition-colors ${
                  likedMap[currentItem.episode.id] ? 'fill-rose-500 text-rose-500' : 'text-white'
                }`} 
              />
            </button>
            <span className="text-[10px] font-mono text-white mt-1">
              {(likeCountMap[currentItem.episode.id] || 1420).toLocaleString()}
            </span>
          </div>

          {/* Bookmark Button */}
          <button
            onClick={() => toggleBookmark(currentItem.book.id)}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform"
            title="Guardar en biblioteca"
          >
            <Bookmark 
              className={`w-5 h-5 ${items[currentItem.book.id]?.is_bookmarked ? 'fill-amber-400 text-amber-400' : 'text-white'}`} 
            />
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform"
            title="Compartir episodio"
          >
            <Share2 className="w-5 h-5" />
          </button>

          {/* Full Player Expand Button */}
          <button
            onClick={handleOpenFullPlayer}
            className="w-11 h-11 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-95 transition-transform"
            title="Abrir reproductor completo"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Swipe Guides (Up / Down) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 opacity-50 hover:opacity-100 transition-opacity">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-20"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === feedItems.length - 1}
            className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white disabled:opacity-20"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Information & Subtitle Overlay */}
        <div className="absolute bottom-4 left-4 right-16 z-20 space-y-2 pointer-events-auto">
          {/* Subtitle Dialogue Line */}
          {activeSubtitle && (
            <div className="inline-block px-3 py-1.5 rounded-xl bg-black/80 border border-white/10 backdrop-blur-md max-w-xs shadow-xl">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                {activeSubtitle.character_name}
                {activeSubtitle.emotion && (
                  <span className="text-[9px] text-slate-400 font-normal italic ml-1">
                    ({activeSubtitle.emotion})
                  </span>
                )}
              </span>
              <p className="text-xs text-white leading-snug font-medium mt-0.5">
                "{activeSubtitle.text}"
              </p>
            </div>
          )}

          {/* Book & Episode Metadata */}
          <div className="space-y-1 text-white">
            <button
              onClick={() => navigate(`/book/${currentItem.book.id}`)}
              className="text-xs font-bold text-amber-300 hover:underline flex items-center gap-1.5"
            >
              <span>{currentItem.book.title}</span>
              <span className="text-slate-400 font-normal">· {currentItem.book.author}</span>
            </button>

            <h3 className="font-display text-base font-bold leading-tight">
              Ep. {currentItem.episode.number}: {currentItem.episode.title}
            </h3>

            {/* Cliffhanger Callout */}
            {currentItem.episode.cliffhanger && (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/20 px-2 py-1 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span className="line-clamp-1 italic">
                  Cliffhanger: {currentItem.episode.cliffhanger}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Share Toast */}
        {showShareToast && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 px-4 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-200 text-xs font-bold shadow-2xl animate-in fade-in duration-150">
            ¡Enlace copiado al portapapeles!
          </div>
        )}
      </div>
    </div>
  );
};
