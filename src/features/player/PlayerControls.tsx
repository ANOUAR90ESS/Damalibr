import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { 
  Play, Pause, RotateCcw, RotateCw, SkipForward, SkipBack, 
  Volume2, VolumeX, Gauge, Tv, Moon, Subtitles, 
  Layers, ListVideo, ChevronDown, Crown
} from 'lucide-react';

interface PlayerControlsProps {
  onOpenFormatSwitcher: () => void;
  onOpenEpisodeDrawer: () => void;
  isVisible: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  onOpenFormatSwitcher,
  onOpenEpisodeDrawer,
  isVisible
}) => {
  const {
    currentBook,
    currentEpisode,
    currentAdaptation,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    quality,
    isMuted,
    subtitlesEnabled,
    sleepTimerMinutes,
    sleepTimerRemainingSeconds,
    togglePlay,
    seek,
    seekRelative,
    toggleMute,
    setPlaybackSpeed,
    setQuality,
    toggleSubtitles,
    setSleepTimer,
    tickSleepTimer,
    toggleMiniPlayer,
    playNextEpisode,
    playPrevEpisode,
  } = usePlayerStore();

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  // Sleep timer interval
  useEffect(() => {
    if (!sleepTimerMinutes) return;
    const interval = setInterval(() => {
      tickSleepTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMinutes, tickSleepTimer]);

  if (!currentBook || !currentEpisode || !currentAdaptation) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];
  const qualityOptions: Array<'auto' | '360p' | '720p' | '1080p'> = ['auto', '360p', '720p', '1080p'];
  const sleepOptions = [
    { label: 'Desactivado', val: null },
    { label: '15 minutos', val: 15 },
    { label: '30 minutos', val: 30 },
    { label: '45 minutos', val: 45 },
    { label: 'Al terminar episodio', val: -1 },
  ];

  return (
    <div 
      className={`absolute inset-0 z-20 flex flex-col justify-between p-4 bg-gradient-to-b from-black/80 via-transparent to-black/90 transition-opacity duration-300 pointer-events-none ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Top Header Controls (Pointer events enabled on buttons) */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto">
        <button
          onClick={() => toggleMiniPlayer(true)}
          className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md flex items-center justify-center text-white/90 active:scale-95 transition-all"
          title="Minimizar reproductor"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="text-center flex-1 min-w-0 px-2">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest block truncate">
            {currentBook.title}
          </span>
          <span className="text-xs font-semibold text-slate-200 block truncate">
            {currentAdaptation.format === 'drama' ? `Episodio ${currentEpisode.number}: ` : ''}
            {currentEpisode.title}
          </span>
        </div>

        {/* Format Switcher Badge Button */}
        <button
          onClick={onOpenFormatSwitcher}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold backdrop-blur-md shadow-lg shadow-amber-500/10 active:scale-95 transition-all"
          title="Cambiar formato conservando la posición de la historia"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="capitalize">{currentAdaptation.format}</span>
        </button>
      </div>

      {/* Middle Quick Seek & Play/Pause Gestures Row */}
      <div className="flex items-center justify-center gap-8 pointer-events-auto my-auto">
        <button
          onClick={playPrevEpisode}
          className="p-3 text-white/80 hover:text-white active:scale-90 transition-transform"
          title="Episodio anterior"
        >
          <SkipBack className="w-6 h-6" />
        </button>

        <button
          onClick={() => seekRelative(-15)}
          className="flex flex-col items-center p-2 text-white/80 hover:text-white active:scale-90 transition-transform"
          title="Retroceder 15s"
        >
          <RotateCcw className="w-7 h-7" />
          <span className="text-[10px] font-mono mt-0.5">-15s</span>
        </button>

        <button
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 active:scale-95 transition-transform"
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 fill-slate-950" />
          ) : (
            <Play className="w-8 h-8 fill-slate-950 ml-1" />
          )}
        </button>

        <button
          onClick={() => seekRelative(15)}
          className="flex flex-col items-center p-2 text-white/80 hover:text-white active:scale-90 transition-transform"
          title="Adelantar 15s"
        >
          <RotateCw className="w-7 h-7" />
          <span className="text-[10px] font-mono mt-0.5">+15s</span>
        </button>

        <button
          onClick={playNextEpisode}
          className="p-3 text-white/80 hover:text-white active:scale-90 transition-transform"
          title="Episodio siguiente"
        >
          <SkipForward className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Controls Area */}
      <div className="space-y-3 pointer-events-auto">
        {/* Scrubber Progress Bar */}
        <div className="space-y-1">
          <div className="relative flex items-center group cursor-pointer py-1">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700/80 rounded-full appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-300">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls Toolbar Bar */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
          <div className="flex items-center gap-1">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); setShowSleepMenu(false); }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  playbackSpeed !== 1.0 ? 'text-amber-400 bg-amber-500/10' : 'text-slate-300 hover:text-white'
                }`}
                title="Velocidad de reproducción"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span className="font-mono">{playbackSpeed}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl space-y-0.5 min-w-[90px]">
                  <span className="text-[10px] text-slate-400 font-semibold px-2 py-1 block">Velocidad</span>
                  {speedOptions.map(spd => (
                    <button
                      key={spd}
                      onClick={() => { setPlaybackSpeed(spd); setShowSpeedMenu(false); }}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-md flex items-center justify-between ${
                        playbackSpeed === spd ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{spd}x</span>
                      {playbackSpeed === spd && <span className="text-amber-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); setShowSleepMenu(false); }}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1"
                title="Calidad de video"
              >
                <Tv className="w-3.5 h-3.5" />
                <span className="uppercase text-[11px]">{quality}</span>
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl space-y-0.5 min-w-[120px]">
                  <span className="text-[10px] text-slate-400 font-semibold px-2 py-1 block">Calidad</span>
                  {qualityOptions.map(q => (
                    <button
                      key={q}
                      onClick={() => { setQuality(q); setShowQualityMenu(false); }}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-md flex items-center justify-between ${
                        quality === q ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="uppercase">{q}</span>
                        {q === '1080p' && (
                          <span className="flex items-center text-[9px] px-1 rounded bg-amber-500/20 text-amber-400 font-bold">
                            <Crown className="w-2.5 h-2.5 mr-0.5 fill-amber-400" /> VIP
                          </span>
                        )}
                      </div>
                      {quality === q && <span className="text-amber-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subtitles Toggle */}
            <button
              onClick={toggleSubtitles}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                subtitlesEnabled ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-white'
              }`}
              title={subtitlesEnabled ? 'Desactivar subtítulos' : 'Activar subtítulos'}
            >
              <Subtitles className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Sleep Timer */}
            <div className="relative">
              <button
                onClick={() => { setShowSleepMenu(!showSleepMenu); setShowSpeedMenu(false); setShowQualityMenu(false); }}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  sleepTimerMinutes ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 hover:text-white'
                }`}
                title="Temporizador de apagado"
              >
                <Moon className="w-4 h-4" />
                {sleepTimerRemainingSeconds && (
                  <span className="font-mono text-[10px] text-purple-300">
                    {Math.ceil(sleepTimerRemainingSeconds / 60)}m
                  </span>
                )}
              </button>

              {showSleepMenu && (
                <div className="absolute bottom-full right-0 mb-2 p-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-xl space-y-0.5 min-w-[150px]">
                  <span className="text-[10px] text-slate-400 font-semibold px-2 py-1 block">Temporizador de apagado</span>
                  {sleepOptions.map(slp => (
                    <button
                      key={slp.label}
                      onClick={() => { setSleepTimer(slp.val); setShowSleepMenu(false); }}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-md flex items-center justify-between ${
                        sleepTimerMinutes === slp.val ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{slp.label}</span>
                      {sleepTimerMinutes === slp.val && <span className="text-purple-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mute button */}
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              title={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Episode List Drawer Toggle */}
            <button
              onClick={onOpenEpisodeDrawer}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white flex items-center gap-1"
              title="Lista de episodios"
            >
              <ListVideo className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
