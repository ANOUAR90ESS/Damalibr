import { create } from 'zustand';
import { UserProfile } from '../types';
import { storageService } from '../lib/supabase';

interface AuthState {
  user: UserProfile;
  isAuthenticated: boolean;
  loginModalOpen: boolean;
  kidsPinModalOpen: boolean;
  pendingKidsPinAction: (() => void) | null;

  // Actions
  loginWithEmail: (email: string, name?: string) => void;
  loginWithGoogle: () => void;
  logout: () => void;
  setLoginModalOpen: (open: boolean) => void;
  toggleKidsMode: () => void;
  setKidsPin: (pin: string) => void;
  verifyKidsPin: (pin: string) => boolean;
  openKidsPinVerification: (onSuccess: () => void) => void;
  closeKidsPinVerification: () => void;
  setLanguage: (lang: 'es-ES' | 'es-LA') => void;
  recordWatchTime: (minutes: number) => void;
  completeEpisodeGoal: () => void;
  setVipStatus: (isVip: boolean) => void;
}

const DEFAULT_USER: UserProfile = {
  id: 'usr-lamina-demo',
  email: 'lector@lamina.app',
  display_name: 'Lector Clásico',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  is_vip: false,
  kids_mode_enabled: false,
  kids_pin: '1234',
  language: 'es-ES',
  daily_goal_minutes: 15,
  streak_days: 7,
  minutes_watched_today: 9,
  total_minutes_watched: 485,
  total_episodes_completed: 24,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: storageService.get<UserProfile>('profile', DEFAULT_USER),
  isAuthenticated: true,
  loginModalOpen: false,
  kidsPinModalOpen: false,
  pendingKidsPinAction: null,

  loginWithEmail: (email: string, name?: string) => {
    const updatedUser: UserProfile = {
      ...get().user,
      email,
      display_name: name || email.split('@')[0],
    };
    storageService.set('profile', updatedUser);
    set({ user: updatedUser, isAuthenticated: true, loginModalOpen: false });
  },

  loginWithGoogle: () => {
    const updatedUser: UserProfile = {
      ...get().user,
      display_name: 'Usuario Google',
      email: 'usuario.google@gmail.com',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    };
    storageService.set('profile', updatedUser);
    set({ user: updatedUser, isAuthenticated: true, loginModalOpen: false });
  },

  logout: () => {
    set({ isAuthenticated: false });
  },

  setLoginModalOpen: (open: boolean) => set({ loginModalOpen: open }),

  toggleKidsMode: () => {
    const currentUser = get().user;
    if (currentUser.kids_mode_enabled) {
      // Trying to disable kids mode requires PIN
      get().openKidsPinVerification(() => {
        const updated = { ...currentUser, kids_mode_enabled: false };
        storageService.set('profile', updated);
        set({ user: updated });
      });
    } else {
      const updated = { ...currentUser, kids_mode_enabled: true };
      storageService.set('profile', updated);
      set({ user: updated });
    }
  },

  setKidsPin: (pin: string) => {
    const updated = { ...get().user, kids_pin: pin };
    storageService.set('profile', updated);
    set({ user: updated });
  },

  verifyKidsPin: (pin: string) => {
    return (get().user.kids_pin || '1234') === pin;
  },

  openKidsPinVerification: (onSuccess: () => void) => {
    set({ kidsPinModalOpen: true, pendingKidsPinAction: onSuccess });
  },

  closeKidsPinVerification: () => {
    set({ kidsPinModalOpen: false, pendingKidsPinAction: null });
  },

  setLanguage: (lang: 'es-ES' | 'es-LA') => {
    const updated = { ...get().user, language: lang };
    storageService.set('profile', updated);
    set({ user: updated });
  },

  recordWatchTime: (minutes: number) => {
    const u = get().user;
    const updated: UserProfile = {
      ...u,
      minutes_watched_today: u.minutes_watched_today + minutes,
      total_minutes_watched: u.total_minutes_watched + minutes,
    };
    storageService.set('profile', updated);
    set({ user: updated });
  },

  completeEpisodeGoal: () => {
    const u = get().user;
    const updated: UserProfile = {
      ...u,
      total_episodes_completed: u.total_episodes_completed + 1,
    };
    storageService.set('profile', updated);
    set({ user: updated });
  },

  setVipStatus: (isVip: boolean) => {
    const updated: UserProfile = {
      ...get().user,
      is_vip: isVip,
    };
    storageService.set('profile', updated);
    set({ user: updated });
  },
}));
