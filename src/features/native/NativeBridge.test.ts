import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(async () => ({ error: null })),
  close: vi.fn(async () => {}),
}));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { exchangeCodeForSession: mocks.exchangeCodeForSession } } }));
vi.mock('@capacitor/browser', () => ({ Browser: { close: mocks.close } }));

const { handleDeepLink } = await import('./NativeBridge');

describe('handleDeepLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('completes Google/email sign-in with the PKCE code', async () => {
    expect(await handleDeepLink('com.lamina.app://auth-callback?code=abc123')).toBe('/profile');
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(mocks.close).toHaveBeenCalled();
  });

  it('opens other app routes', async () => {
    expect(await handleDeepLink('com.lamina.app://book/book-quijote')).toBe('/book/book-quijote');
    expect(await handleDeepLink('com.lamina.app://profile?checkout=success')).toBe('/profile?checkout=success');
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('ignores links for other schemes', async () => {
    expect(await handleDeepLink('https://evil.example/auth-callback?code=x')).toBeNull();
  });
});
