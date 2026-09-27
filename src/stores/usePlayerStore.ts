import { create } from 'zustand';
import { Book, Adaptation, Episode, BookFormat, ScriptLine } from '../types';
import { SEED_BOOKS, SEED_ADAPTATIONS, SEED_EPISODES } from '../data/seedBooks';
import { useLibraryStore } from './useLibraryStore';
import { useWalletStore } from './useWalletStore';

interface PlayerState {
  // Current playback entities
  currentBook: Book | null;
  currentAdaptation: Adaptation | null;
  currentEpisode: Episode | null;

  // Playback state
  isPlaying: boolean;
  currentTime: number; // in seconds
  duration: number;    // in seconds
  volume: number;      // 0 to 1
  isMuted: boolean;
  playbackSpeed: number; // 0.75, 1, 1.25, 1.5, 2
  quality: 'auto' | '360p' | '720p' | '1080p';
  subtitlesEnabled: boolean;
  currentSubtitle: ScriptLine | null;

  // View state
  isOpen: boolean;        // Player is active (fullscreen or mini)
  isMiniPlayer: boolean;  // Minimized to bottom floating bar
  episodeDrawerOpen: boolean;
  sleepTimerMinutes: number | null; // null = off, 15, 30, 45, or -1 (end of episode)
  sleepTimerRemainingSeconds: number | null;

  // Actions
  playEpisode: (book: Book, adaptation: Adaptation, episode: Episode, startSeconds?: number) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  seekRelative: (offsetSeconds: number) => void; // ±15s
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setQuality: (quality: 'auto' | '360p' | '720p' | '1080p') => void;
  toggleSubtitles: () => void;
  setSleepTimer: (minutes: number | null) => void;
  tickSleepTimer: () => void;
  toggleMiniPlayer: (mini?: boolean) => void;
  closePlayer: () => void;
  setEpisodeDrawerOpen: (open: boolean) => void;
  playNextEpisode: () => void;
  playPrevEpisode: () => void;

  // Format Switcher with story_position mapping
  switchFormat: (targetFormat: BookFormat) => void;
  getCurrentStoryPosition: () => number;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentBook: null,
  currentAdaptation: null,
  currentEpisode: null,

  isPlaying: false,
  currentTime: 0,
  duration: 120,
  volume: 1,
  isMuted: false,
  playbackSpeed: 1.0,
  quality: 'auto',
  subtitlesEnabled: true,
  currentSubtitle: null,

  isOpen: false,
  isMiniPlayer: false,
  episodeDrawerOpen: false,
  sleepTimerMinutes: null,
  sleepTimerRemainingSeconds: null,

  playEpisode: (book: Book, adaptation: Adaptation, episode: Episode, startSeconds = 0) => {
    // Check lock state
    const isAccessible = useWalletStore.getState().isEpisodeAccessible(episode);
    if (!isAccessible) {
      useWalletStore.getState().openUnlockModal(episode);
      return;
    }

    set({
      currentBook: book,
      currentAdaptation: adaptation,
      currentEpisode: episode,
      currentTime: startSeconds,
      duration: episode.duration || 120,
      isPlaying: true,
      isOpen: true,
      isMiniPlayer: false,
      episodeDrawerOpen: false,
    });

    // Record in library
    useLibraryStore.getState().saveProgress(book.id, adaptation.id, episode.id, startSeconds);
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  seek: (seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, get().duration));
    set({ currentTime: clamped });

    // Update active subtitle
    const ep = get().currentEpisode;
    if (ep && ep.script_json?.scenes) {
      let activeLine: ScriptLine | null = null;
      let accumulatedTime = 0;

      for (const scene of ep.script_json.scenes) {
        for (const line of scene.lines) {
          const start = accumulatedTime;
          const end = start + line.duration_seconds;
          if (clamped >= start && clamped <= end) {
            activeLine = line;
            break;
          }
          accumulatedTime = end;
        }
        if (activeLine) break;
      }
      set({ currentSubtitle: activeLine });
    }

    // Persist progress periodically
    const { currentBook, currentAdaptation, currentEpisode } = get();
    if (currentBook && currentAdaptation && currentEpisode) {
      useLibraryStore.getState().saveProgress(
        currentBook.id,
        currentAdaptation.id,
        currentEpisode.id,
        clamped
      );
    }
  },

  seekRelative: (offset: number) => {
    const nextTime = get().currentTime + offset;
    get().seek(nextTime);
  },

  setDuration: (duration: number) => set({ duration }),

  setCurrentTime: (time: number) => {
    set({ currentTime: time });

    // Check subtitle
    const ep = get().currentEpisode;
    if (ep && ep.script_json?.scenes) {
      let activeLine: ScriptLine | null = null;
      let accumulatedTime = 0;

      for (const scene of ep.script_json.scenes) {
        for (const line of scene.lines) {
          const start = accumulatedTime;
          const end = start + line.duration_seconds;
          if (time >= start && time <= end) {
            activeLine = line;
            break;
          }
          accumulatedTime = end;
        }
        if (activeLine) break;
      }
      set({ currentSubtitle: activeLine });
    }
  },

  setVolume: (volume: number) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set(state => ({ isMuted: !state.isMuted })),
  setPlaybackSpeed: (playbackSpeed: number) => set({ playbackSpeed }),

  setQuality: (quality: 'auto' | '360p' | '720p' | '1080p') => {
    // 1080p is VIP only!
    if (quality === '1080p') {
      const isVip = useWalletStore.getState().isEpisodeAccessible({ ...get().currentEpisode!, is_free: false, coin_price: 999 });
      if (!isVip) {
        useWalletStore.getState().openVipModal();
        return;
      }
    }
    set({ quality });
  },

  toggleSubtitles: () => set(state => ({ subtitlesEnabled: !state.subtitlesEnabled })),

  setSleepTimer: (minutes: number | null) => {
    set({
      sleepTimerMinutes: minutes,
      sleepTimerRemainingSeconds: minutes && minutes > 0 ? minutes * 60 : null,
    });
  },

  tickSleepTimer: () => {
    const remaining = get().sleepTimerRemainingSeconds;
    if (remaining !== null) {
      if (remaining <= 1) {
        set({ isPlaying: false, sleepTimerMinutes: null, sleepTimerRemainingSeconds: null });
      } else {
        set({ sleepTimerRemainingSeconds: remaining - 1 });
      }
    }
  },

  toggleMiniPlayer: (mini?: boolean) => {
    set(state => ({
      isMiniPlayer: mini !== undefined ? mini : !state.isMiniPlayer,
      isOpen: true,
    }));
  },

  closePlayer: () => {
    set({
      isOpen: false,
      isMiniPlayer: false,
      isPlaying: false,
    });
  },

  setEpisodeDrawerOpen: (open: boolean) => set({ episodeDrawerOpen: open }),

  getCurrentStoryPosition: () => {
    const { currentEpisode, currentTime, duration } = get();
    if (!currentEpisode) return 0;
    const progressWithinEpisode = duration > 0 ? currentTime / duration : 0;
    const arcDelta = currentEpisode.story_position_end - currentEpisode.story_position_start;
    return Math.min(1.0, currentEpisode.story_position_start + progressWithinEpisode * arcDelta);
  },

  // The critical FORMAT SWITCHER jumping to matching story_position
  switchFormat: (targetFormat: BookFormat) => {
    const { currentBook, currentAdaptation } = get();
    if (!currentBook || !currentAdaptation) return;
    if (currentAdaptation.format === targetFormat) return;

    // 1. Calculate current story position across the entire narrative arc (0.0 to 1.0)
    const currentStoryPos = get().getCurrentStoryPosition();

    // 2. Find target adaptation
    const bookAdaptations = SEED_ADAPTATIONS[currentBook.id] || [];
    const targetAdaptation = bookAdaptations.find(a => a.format === targetFormat);
    if (!targetAdaptation) return;

    // 3. Find episode in target adaptation matching the story position
    const targetEpisodes = SEED_EPISODES[targetAdaptation.id] || [];
    if (!targetEpisodes.length) return;

    // Find episode where story_position_start <= currentStoryPos <= story_position_end
    let matchingEp = targetEpisodes.find(
      ep => currentStoryPos >= ep.story_position_start && currentStoryPos <= ep.story_position_end
    );

    // Fallback to closest episode if not strictly between
    if (!matchingEp) {
      matchingEp = targetEpisodes.reduce((prev, curr) => {
        return Math.abs(curr.story_position_start - currentStoryPos) < Math.abs(prev.story_position_start - currentStoryPos)
          ? curr
          : prev;
      });
    }

    // 4. Calculate matching timestamp within the target episode
    const epArc = matchingEp.story_position_end - matchingEp.story_position_start;
    const posInEp = epArc > 0 ? (currentStoryPos - matchingEp.story_position_start) / epArc : 0;
    const targetSeconds = Math.round(Math.max(0, Math.min(posInEp * matchingEp.duration, matchingEp.duration)));

    // 5. Play target episode at that exact timestamp
    get().playEpisode(currentBook, targetAdaptation, matchingEp, targetSeconds);
  },

  playNextEpisode: () => {
    const { currentAdaptation, currentEpisode, currentBook } = get();
    if (!currentAdaptation || !currentEpisode || !currentBook) return;

    const episodes = SEED_EPISODES[currentAdaptation.id] || [];
    const currentIndex = episodes.findIndex(e => e.id === currentEpisode.id);
    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1];
      get().playEpisode(currentBook, currentAdaptation, nextEp, 0);
    }
  },

  playPrevEpisode: () => {
    const { currentAdaptation, currentEpisode, currentBook } = get();
    if (!currentAdaptation || !currentEpisode || !currentBook) return;

    const episodes = SEED_EPISODES[currentAdaptation.id] || [];
    const currentIndex = episodes.findIndex(e => e.id === currentEpisode.id);
    if (currentIndex > 0) {
      const prevEp = episodes[currentIndex - 1];
      get().playEpisode(currentBook, currentAdaptation, prevEp, 0);
    }
  }
}));
