import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fetchProfile } from './api/userData';
import { useAuthStore } from '../stores/useAuthStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useCatalogStore } from '../stores/useCatalogStore';

// undefined = no session processed yet, null = signed out
let currentUserId: string | null | undefined = undefined;

async function applySession(session: Session | null) {
  const userId = session?.user.id ?? null;
  if (userId === currentUserId) {
    useAuthStore.getState().markAuthReady();
    return;
  }
  currentUserId = userId;

  if (!session || !userId) {
    useAuthStore.getState().clearRemoteSession();
    useLibraryStore.getState().resetToLocal();
    return;
  }

  try {
    const { profile, isVip } = await fetchProfile(userId);
    if (currentUserId !== userId) return; // session changed while loading
    useAuthStore.getState().applyRemoteSession({
      userId,
      email: session.user.email ?? '',
      profile: {
        ...profile,
        display_name: profile.display_name || session.user.user_metadata?.full_name,
        avatar_url: profile.avatar_url || session.user.user_metadata?.avatar_url,
      },
      isVip,
    });
  } catch (e) {
    console.warn('No se pudo cargar el perfil desde Supabase', e);
    useAuthStore.getState().applyRemoteSession({ userId, email: session.user.email ?? '', profile: {}, isVip: false });
  }
  await useLibraryStore.getState().loadRemote(userId);
}

// Wires Supabase auth into the stores and loads the remote catalog.
// Does nothing in local demo mode (no Supabase credentials).
export function initSession(): () => void {
  if (!supabase) return () => {};

  useCatalogStore.getState().loadCatalog();

  // onAuthStateChange fires INITIAL_SESSION right away, so no separate getSession() call is needed.
  // Supabase calls into the handler while holding its auth lock; defer our own queries to avoid a deadlock.
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => void applySession(session), 0);
  });

  return () => data.subscription.unsubscribe();
}
