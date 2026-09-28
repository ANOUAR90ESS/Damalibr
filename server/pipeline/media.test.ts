import { describe, expect, it, vi } from 'vitest';
import { LocalMediaStore, SupabaseMediaStore } from './media';

describe('media access', () => {
  it('returns an API gateway URL instead of a permanent public URL', async () => {
    const admin = {
      storage: {
        from: () => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          download: vi.fn(),
        }),
      },
    } as any;

    const store = new SupabaseMediaStore(admin);
    await expect(store.put('projects/p1/video/v1.mp4', Buffer.from('x'), 'video/mp4'))
      .resolves.toBe('/api/media?key=projects%2Fp1%2Fvideo%2Fv1.mp4');
  });

  it('rejects path traversal for local storage keys', async () => {
    const store = new LocalMediaStore('/tmp/damalibr-media');
    await expect(store.put('../secret.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow();
  });
});
