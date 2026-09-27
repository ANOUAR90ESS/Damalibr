// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ updateProfile: vi.fn(() => Promise.resolve()), setKidsModeRemote: vi.fn() }));
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

describe('kids mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({ remoteUserId: null });
    useAuthStore.setState(s => ({ user: { ...s.user, kids_mode_enabled: false, kids_pin_set: false } }));
  });

  it('requires creating a 4-digit PIN the first time and never stores it in clear text', async () => {
    const { setKidsMode } = useAuthStore.getState();
    expect(await setKidsMode(true)).toEqual({ ok: false, error: 'pin_required' });
    expect(await setKidsMode(true, '12a4')).toEqual({ ok: false, error: 'pin_required' });

    expect(await setKidsMode(true, '4321')).toEqual({ ok: true });
    expect(useAuthStore.getState().user).toMatchObject({ kids_mode_enabled: true, kids_pin_set: true });
    expect(JSON.stringify(localStorage)).not.toContain('4321');
  });

  it('needs the right PIN to switch kids mode off', async () => {
    const { setKidsMode } = useAuthStore.getState();
    await setKidsMode(true, '4321');
    expect(await setKidsMode(false, '0000')).toEqual({ ok: false, error: 'wrong_pin' });
    expect(useAuthStore.getState().user.kids_mode_enabled).toBe(true);
    expect(await setKidsMode(false, '4321')).toEqual({ ok: true });
    expect(useAuthStore.getState().user.kids_mode_enabled).toBe(false);
    // Re-enabling reuses the existing PIN
    expect(await setKidsMode(true)).toEqual({ ok: true });
  });

  it('delegates to the set_kids_mode RPC when signed in', async () => {
    api.setKidsModeRemote.mockResolvedValue({ ok: false, error: 'locked', kids_mode_enabled: true });
    useAuthStore.setState({ remoteUserId: 'u1' });
    expect(await useAuthStore.getState().setKidsMode(false, '1111')).toEqual({ ok: false, error: 'locked' });
    expect(api.setKidsModeRemote).toHaveBeenCalledWith(false, '1111');
  });
});
