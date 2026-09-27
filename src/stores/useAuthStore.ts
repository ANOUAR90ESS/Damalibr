import { create } from 'zustand';
import { UserProfile } from '../types';
import { isSupabaseConfigured, storageService, supabase } from '../lib/supabase';
import { authRedirectUrl, isNative } from '../lib/platform';
import { Browser } from '@capacitor/browser';
import { KidsModeError, ProfileUpdate, setKidsModeRemote, updateProfile } from '../lib/api/userData';

export interface AuthResult {
  ok: boolean;
  message: string;
}

export interface KidsModeResult {
  ok: boolean;
  error?: KidsModeError;
}

interface AuthState {
  user: UserProfile;
  isAuthenticated: boolean;
  /** 'supabase' when real accounts are available, 'local' for the offline demo mode */
  authMode: 'local' | 'supabase';
  /** false until the initial Supabase session check has finished */
  authReady: boolean;
  /** Supabase user id when signed in with a real account */
  remoteUserId: string | null;
  role: 'user' | 'admin';
  loginModalOpen: boolean;

  // Actions
  loginWithEmail: (email: string, name?: string) => Promise<AuthResult>;
  loginWithGoogle: () => Promise<AuthResult>;
  logout: () => Promise<void>;
  applyRemoteSession: (session: { userId: string; email: string; profile: Partial<UserProfile> & { role?: 'user' | 'admin' }; isVip: boolean }) => void;
  clearRemoteSession: () => void;
  markAuthReady: () => void;
  setLoginModalOpen: (open: boolean) => void;
  /**
   * Turns kids mode on or off. Enabling the first time requires choosing a 4-digit PIN
   * (error 'pin_required' otherwise); disabling requires that PIN.
   */
  setKidsMode: (enabled: boolean, pin?: string) => Promise<KidsModeResult>;
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
  kids_pin_set: false,
  language: 'es-ES',
  daily_goal_minutes: 15,
  streak_days: 7,
  minutes_watched_today: 9,
  total_minutes_watched: 485,
  total_episodes_completed: 24,
};

const LOCAL_PIN_KEY = 'kids_pin_hash';

function localPinHash(): { salt: string; hash: string } | null {
  return storageService.get<{ salt: string; hash: string } | null>(LOCAL_PIN_KEY, null);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// Saves the profile locally and, when signed in with Supabase, syncs the given fields.
function persistProfile(updated: UserProfile, remotePatch?: ProfileUpdate) {
  storageService.set('profile', updated);
  const remoteUserId = useAuthStore.getState().remoteUserId;
  if (remoteUserId && remotePatch) {
    updateProfile(remoteUserId, remotePatch).catch(e => console.warn('No se pudo sincronizar el perfil', e));
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: storageService.get<UserProfile>('profile', DEFAULT_USER),
  // In local demo mode the user is always "signed in"; with Supabase we wait for a real session.
  isAuthenticated: !isSupabaseConfigured,
  authMode: isSupabaseConfigured ? 'supabase' : 'local',
  authReady: !isSupabaseConfigured,
  remoteUserId: null,
  role: 'user',
  loginModalOpen: false,

  loginWithEmail: async (email: string, name?: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: authRedirectUrl(),
          data: name ? { full_name: name } : undefined,
        },
      });
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Te hemos enviado un enlace de acceso a ${email}. Ábrelo para entrar.` };
    }

    const updatedUser: UserProfile = {
      ...get().user,
      email,
      display_name: name || email.split('@')[0],
    };
    storageService.set('profile', updatedUser);
    set({ user: updatedUser, isAuthenticated: true, loginModalOpen: false });
    return { ok: true, message: 'Sesión iniciada en modo local.' };
  },

  loginWithGoogle: async () => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // In the app, open Google in the system browser; it returns through the deep link.
        options: { redirectTo: authRedirectUrl(), skipBrowserRedirect: isNative },
      });
      if (error) return { ok: false, message: error.message };
      if (isNative && data.url) await Browser.open({ url: data.url, presentationStyle: 'popover' });
      return { ok: true, message: 'Continúa en la ventana de Google…' };
    }

    const updatedUser: UserProfile = {
      ...get().user,
      display_name: 'Usuario Google',
      email: 'usuario.google@gmail.com',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    };
    storageService.set('profile', updatedUser);
    set({ user: updatedUser, isAuthenticated: true, loginModalOpen: false });
    return { ok: true, message: 'Sesión iniciada en modo local.' };
  },

  logout: async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('Error al cerrar sesión', error);
      get().clearRemoteSession();
      return;
    }
    set({ isAuthenticated: false });
  },

  applyRemoteSession: ({ userId, email, profile, isVip }) => {
    const user: UserProfile = {
      ...DEFAULT_USER,
      id: userId,
      email,
      display_name: profile.display_name || email.split('@')[0],
      avatar_url: profile.avatar_url || DEFAULT_USER.avatar_url,
      is_vip: isVip,
      kids_mode_enabled: profile.kids_mode_enabled ?? false,
      kids_pin_set: profile.kids_pin_set ?? false,
      language: profile.language || 'es-ES',
      daily_goal_minutes: profile.daily_goal_minutes ?? DEFAULT_USER.daily_goal_minutes,
      streak_days: profile.streak_days ?? 0,
      minutes_watched_today: profile.minutes_watched_today ?? 0,
      total_minutes_watched: profile.total_minutes_watched ?? 0,
      total_episodes_completed: profile.total_episodes_completed ?? 0,
    };
    storageService.set('profile', user);
    set({
      user,
      isAuthenticated: true,
      authReady: true,
      remoteUserId: userId,
      role: profile.role || 'user',
      loginModalOpen: false,
    });
  },

  clearRemoteSession: () => {
    const guest: UserProfile = {
      ...DEFAULT_USER,
      id: 'guest',
      email: '',
      display_name: 'Invitado',
      kids_mode_enabled: false,
      kids_pin_set: localPinHash() !== null,
      streak_days: 0,
      minutes_watched_today: 0,
      total_minutes_watched: 0,
      total_episodes_completed: 0,
    };
    storageService.set('profile', guest);
    set({ user: guest, isAuthenticated: false, remoteUserId: null, role: 'user', authReady: true });
  },

  markAuthReady: () => set({ authReady: true }),

  setLoginModalOpen: (open: boolean) => set({ loginModalOpen: open }),

  setKidsMode: async (enabled: boolean, pin?: string) => {
    const { remoteUserId, user } = get();

    if (remoteUserId) {
      const result = await setKidsModeRemote(enabled, pin);
      if (result.ok) {
        const updated = { ...user, kids_mode_enabled: result.kids_mode_enabled, kids_pin_set: true };
        storageService.set('profile', updated);
        set({ user: updated });
      }
      return { ok: result.ok, error: result.error };
    }

    // Local mode: a salted SHA-256 of the PIN is kept on this device.
    const stored = localPinHash();
    if (enabled) {
      if (!stored) {
        if (!pin || !/^[0-9]{4}$/.test(pin)) return { ok: false, error: 'pin_required' };
        const salt = crypto.randomUUID();
        storageService.set(LOCAL_PIN_KEY, { salt, hash: await sha256(salt + pin) });
      }
    } else if (stored && (!pin || (await sha256(stored.salt + pin)) !== stored.hash)) {
      return { ok: false, error: 'wrong_pin' };
    }

    const updated = { ...user, kids_mode_enabled: enabled, kids_pin_set: localPinHash() !== null };
    storageService.set('profile', updated);
    set({ user: updated });
    return { ok: true };
  },

  setLanguage: (lang: 'es-ES' | 'es-LA') => {
    const updated = { ...get().user, language: lang };
    persistProfile(updated, { language: lang });
    set({ user: updated });
  },

  recordWatchTime: (minutes: number) => {
    const u = get().user;
    const updated: UserProfile = {
      ...u,
      minutes_watched_today: u.minutes_watched_today + minutes,
      total_minutes_watched: u.total_minutes_watched + minutes,
    };
    persistProfile(updated, {
      minutes_watched_today: updated.minutes_watched_today,
      total_minutes_watched: updated.total_minutes_watched,
    });
    set({ user: updated });
  },

  completeEpisodeGoal: () => {
    const u = get().user;
    const updated: UserProfile = {
      ...u,
      total_episodes_completed: u.total_episodes_completed + 1,
    };
    persistProfile(updated, { total_episodes_completed: updated.total_episodes_completed });
    set({ user: updated });
  },

  setVipStatus: (isVip: boolean) => {
    const updated: UserProfile = {
      ...get().user,
      is_vip: isVip,
    };
    // VIP status is read from `subscriptions` on sign-in; it is not writable from the client.
    persistProfile(updated);
    set({ user: updated });
  },
}));
