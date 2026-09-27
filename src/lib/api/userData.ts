import { supabase } from '../supabase';
import { LibraryItem, UserProfile, UserProgress } from '../../types';

// Profile fields users are allowed to change (mirrors the column GRANT in the migration).
export type ProfileUpdate = Partial<Pick<UserProfile,
  | 'display_name'
  | 'avatar_url'
  | 'language'
  | 'daily_goal_minutes'
  | 'streak_days'
  | 'minutes_watched_today'
  | 'total_minutes_watched'
  | 'total_episodes_completed'
>>;

export interface RemoteProfile {
  profile: Partial<UserProfile> & { role?: 'user' | 'admin' };
  isVip: boolean;
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

export async function fetchProfile(userId: string): Promise<RemoteProfile> {
  const db = client();
  const [profile, subscription] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).maybeSingle(),
    db.from('subscriptions').select('tier, status, current_period_end').eq('user_id', userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (subscription.error) throw subscription.error;

  const sub = subscription.data;
  const isVip = Boolean(
    sub && sub.tier === 'vip' && sub.status === 'active' &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date())
  );

  return { profile: profile.data || {}, isVip };
}

export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<void> {
  const { error } = await client()
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function fetchLibrary(userId: string): Promise<{
  items: LibraryItem[];
  progress: UserProgress[];
  likedBookIds: string[];
}> {
  const db = client();
  const [library, progress, likes] = await Promise.all([
    db.from('library').select('user_id, book_id, state, is_bookmarked, is_downloaded, download_size_mb, updated_at').eq('user_id', userId),
    db.from('user_progress').select('user_id, book_id, adaptation_id, episode_id, seconds, completed, updated_at').eq('user_id', userId),
    db.from('likes').select('book_id').eq('user_id', userId),
  ]);
  const error = library.error || progress.error || likes.error;
  if (error) throw error;

  return {
    items: (library.data || []).map(i => ({ ...i, download_size_mb: Number(i.download_size_mb) })) as LibraryItem[],
    progress: (progress.data || []) as UserProgress[],
    likedBookIds: (likes.data || []).map(l => l.book_id as string),
  };
}

export async function upsertLibraryItem(item: LibraryItem): Promise<void> {
  const { error } = await client().from('library').upsert(item, { onConflict: 'user_id,book_id' });
  if (error) throw error;
}

export async function upsertProgress(progress: UserProgress): Promise<void> {
  const { error } = await client().from('user_progress').upsert(progress, { onConflict: 'user_id,adaptation_id,episode_id' });
  if (error) throw error;
}

export async function setLike(userId: string, bookId: string, liked: boolean): Promise<void> {
  const db = client();
  const { error } = liked
    ? await db.from('likes').upsert({ user_id: userId, book_id: bookId }, { onConflict: 'user_id,book_id', ignoreDuplicates: true })
    : await db.from('likes').delete().eq('user_id', userId).eq('book_id', bookId);
  if (error) throw error;
}

export type KidsModeError = 'pin_required' | 'wrong_pin' | 'locked';

// Kids mode is switched server-side so the PIN hash never reaches the client.
export async function setKidsModeRemote(enabled: boolean, pin?: string): Promise<{ ok: boolean; error?: KidsModeError; kids_mode_enabled: boolean }> {
  const { data, error } = await client().rpc('set_kids_mode', { p_enabled: enabled, p_pin: pin ?? null });
  if (error) throw error;
  return data;
}
