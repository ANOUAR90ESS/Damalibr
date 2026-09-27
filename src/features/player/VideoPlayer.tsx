import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { PlayerControls } from './PlayerControls';
import { FormatSwitcher } from './FormatSwitcher';
import { UnlockModal } from './UnlockModal';
import { CoinShopModal } from './CoinShopModal';
import { VipModal } from './VipModal';
import { useCatalogStore } from '../../stores/useCatalogStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { Lock, Play, X, Sparkles, Volume2, VolumeX } from 'lucide-react';

export const VideoPlayer: React.FC = () => {
  const { episodesByAdaptation } = useCatalogStore();
  const {
    currentBook,
    currentAdaptation,
    currentEpisode,
    isOpen,
    isMiniPlayer,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    volume,
    isMuted,
    subtitlesEnabled,
    currentSubtitle,
    episodeDrawerOpen,
    setCurrentTime,
    setDuration,
    pause,
    playEpisode,
    setEpisodeDrawerOpen,
    seekRelative,
  } = usePlayerStore();

  const { isEpisodeAccessible, openUnlockModal } = useWalletStore();

  const [controlsVisible, setControlsVisible] = useState(true);
  const [formatSwitcherOpen, setFormatSwitcherOpen] = useState(false);
  const [doubleTapAnimation, setDoubleTapAnimation] = useState<'left' | 'right' | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // Auto-hide controls after 3.5s of inactivity
  const resetControlsTimeout = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // HLS.js or native video setup
  useEffect(() => {
    if (!isOpen || isMiniPlayer || !currentEpisode || !videoRef.current) return;

    const video = videoRef.current;
    const streamSource = currentEpisode.hls_url || currentEpisode.video_url;

    if (currentEpisode.hls_url && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(streamSource);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isPlaying) {
          video.play().catch(() => {});
        }
      });
    } else {
      video.src = streamSource;
      if (isPlaying) {
        video.play().catch(() => {});
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentEpisode?.id, isOpen, isMiniPlayer]);

  // Sync play/pause, volume, speed with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }

    video.playbackRate = playbackSpeed;
    video.volume = isMuted ? 0 : volume;
  }, [isPlaying, playbackSpeed, volume, isMuted]);

  // Simulated timeline ticker if video is stalled or canvas mode
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
      } else {
        const next = currentTime + playbackSpeed;
        if (duration > 0 && next >= duration) {
          pause();
        } else {
          setCurrentTime(next);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, duration, playbackSpeed]);

  if (!isOpen || isMiniPlayer || !currentBook || !currentEpisode || !currentAdaptation) {
    return null;
  }

  // Handle double tap to seek ±15s
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;

    if (now - lastTapRef.current.time < 300) {
      // Double tap detected
      if (isLeft) {
        seekRelative(-15);
        setDoubleTapAnimation('left');
      } else {
        seekRelative(15);
        setDoubleTapAnimation('right');
      }
      setTimeout(() => setDoubleTapAnimation(null), 600);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
      setControlsVisible(!controlsVisible);
      resetControlsTimeout();
    }
  };

  const isVertical = currentAdaptation.format === 'drama' || currentAdaptation.format === 'summary';
  const episodes = episodesByAdaptation[currentAdaptation.id] || [];

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none">
      {/* Aspect Ratio Container (Full height 9:16 on mobile, constrained on desktop) */}
      <div 
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative overflow-hidden w-full h-full bg-slate-950 flex items-center justify-center ${
          isVertical 
            ? 'max-w-md max-h-full sm:rounded-3xl sm:border sm:border-slate-800' 
            : 'max-w-4xl max-h-[85vh] sm:rounded-3xl sm:border sm:border-slate-800'
        }`}
      >
        {/* Background Visual Layer: Ken Burns or Video */}
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            playsInline
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || currentEpisode.duration || 120)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            className="w-full h-full object-cover"
          />

          {/* Fallback Animated Scene Backdrop with Ken Burns effect */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <img 
              src={currentEpisode.thumbnail_url || currentBook.backdrop_url} 
              alt={currentEpisode.title}
              className="w-full h-full object-cover animate-kenburns-1 filter brightness-90 contrast-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60 pointer-events-none" />
          </div>
        </div>

        {/* Double Tap Ripple Animation Indicator */}
        {doubleTapAnimation && (
          <div 
            className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center w-28 h-28 rounded-full bg-white/20 backdrop-blur-sm animate-ping ${
              doubleTapAnimation === 'left' ? 'left-10' : 'right-10'
            }`}
          >
            <span className="text-xl font-mono font-black text-white">
              {doubleTapAnimation === 'left' ? '-15s' : '+15s'}
            </span>
          </div>
        )}

        {/* Real-Time Synchronized Subtitle Overlay */}
        {subtitlesEnabled && currentSubtitle && (
          <div className="absolute bottom-24 left-4 right-4 z-20 pointer-events-none text-center animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="inline-block max-w-sm px-3.5 py-1.5 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md shadow-2xl">
              <span className="text-[11px] font-bold text-amber-400 block tracking-wide uppercase">
                {currentSubtitle.character_name}
                {currentSubtitle.emotion && (
                  <span className="text-[10px] text-slate-400 font-normal italic ml-1.5 lowercase">
                    ({currentSubtitle.emotion})
                  </span>
                )}
              </span>
              <p className="text-sm font-medium text-white drop-shadow leading-snug mt-0.5">
                "{currentSubtitle.text}"
              </p>
            </div>
          </div>
        )}

        {/* Controls Overlay Layer */}
        <PlayerControls
          isVisible={controlsVisible}
          onOpenFormatSwitcher={() => setFormatSwitcherOpen(true)}
          onOpenEpisodeDrawer={() => setEpisodeDrawerOpen(true)}
        />

        {/* Episode Selector Drawer Sheet */}
        {episodeDrawerOpen && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 z-40 w-full sm:w-80 bg-slate-900/98 border-l border-slate-800 p-4 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-display text-sm font-bold text-slate-100">
                  Episodios de la Adaptación
                </h4>
                <span className="text-xs text-slate-400 capitalize">
                  {currentAdaptation.format} ({episodes.length} episodios)
                </span>
              </div>
              <button 
                onClick={() => setEpisodeDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 py-2 no-scrollbar space-y-1">
              {episodes.map((ep) => {
                const isSelected = ep.id === currentEpisode.id;
                const isAccessible = isEpisodeAccessible(ep);

                return (
                  <button
                    key={ep.id}
                    onClick={() => {
                      if (isAccessible) {
                        playEpisode(currentBook, currentAdaptation, ep, 0);
                        setEpisodeDrawerOpen(false);
                      } else {
                        openUnlockModal(ep);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 ${
                      isSelected 
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200' 
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                      <img 
                        src={ep.thumbnail_url || currentBook.cover_url} 
                        alt={ep.title} 
                        className="w-full h-full object-cover" 
                      />
                      {!isAccessible && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-amber-400">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 truncate">
                          Ep. {ep.number}: {ep.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span className="font-mono">{Math.floor(ep.duration / 60)} min</span>
                        <span>·</span>
                        {isAccessible ? (
                          <span className="text-emerald-400 font-semibold">Desbloqueado</span>
                        ) : (
                          <span className="text-amber-400 font-semibold">{ep.coin_price} monedas</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Format Switcher Modal */}
      {formatSwitcherOpen && (
        <FormatSwitcher onClose={() => setFormatSwitcherOpen(false)} />
      )}

      {/* Unlock Episode Modal */}
      <UnlockModal />

      {/* Coin Shop & VIP Modals */}
      <CoinShopModal />
      <VipModal />
    </div>
  );
};
