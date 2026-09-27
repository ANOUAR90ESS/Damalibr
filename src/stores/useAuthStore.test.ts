// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ updateProfile: vi.fn(() => Promise.resolve()) }));
vi.mock('../lib/api/userData', () => api);

const { useAuthStore } = await import('./useAuthStore');

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ remoteUserId: null, isAuthenticated: true });
  });

  it('runs in local demo mode when Supabase is not configured', async () => {
    expect(useAuthStore.getState().authMode).toBe('local');
    const result = await useAuthStore.getState().loginWithEmail('ana@example.com', 'Ana');
    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().user.display_name).toBe('Ana');
  });

  it('applies a remote session and syncs profile changes', () => {
    useAuthStore.getState().applyRemoteSession({
      userId: 'u1',
      email: 'ana@example.com',
      profile: { display_name: 'Ana', language: 'es-LA', role: 'admin', total_minutes_watched: 10 },
      isVip: true,
    });

    const state = useAuthStore.getState();
    expect(state).toMatchObject({ isAuthenticated: true, remoteUserId: 'u1', role: 'admin' });
    expect(state.user).toMatchObject({ id: 'u1', display_name: 'Ana', language: 'es-LA', is_vip: true, total_minutes_watched: 10 });

    useAuthStore.getState().setLanguage('es-ES');
    expect(api.updateProfile).toHaveBeenCalledWith('u1', { language: 'es-ES' });
  });

  it('does not sync profile changes for guests', () => {
    useAuthStore.getState().setLanguage('es-LA');
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('clears the remote session back to a guest profile', () => {
    useAuthStore.getState().applyRemoteSession({ userId: 'u1', email: 'a@b.c', profile: {}, isVip: true });
    useAuthStore.getState().clearRemoteSession();

    const state = useAuthStore.getState();
    expect(state).toMatchObject({ isAuthenticated: false, remoteUserId: null, role: 'user' });
    expect(state.user).toMatchObject({ id: 'guest', is_vip: false, email: '' });
  });
});
