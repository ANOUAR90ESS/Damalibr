import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Local storage helper for mock/offline fallback
export const storageService = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(`lamina_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`lamina_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(`lamina_${key}`);
    } catch (e) {
      console.warn('Storage remove failed', e);
    }
  }
};
