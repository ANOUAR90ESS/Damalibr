// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Episode } from '../types';

const native = vi.hoisted(() => ({ isNative: true }));
const fs = vi.hoisted(() => ({
  downloadFile: vi.fn(async () => ({})),
  getUri: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///data/${path}` })),
  stat: vi.fn(async () => ({ size: 5 * 1024 * 1024 })),
  rmdir: vi.fn(async () => {}),
}));
vi.mock('./platform', () => ({
  get isNative() { return native.isNative; },
  mediaUrl: (u: string) => (u.startsWith('/') ? `https://api.lamina.test${u}` : u),
}));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fs, Directory: { Data: 'DATA' } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { convertFileSrc: (u: string) => u.replace('file://', 'https://localhost/_capacitor_file_') } }));

const offline = await import('./offline');
const ep = (id: string, video_url: string) => ({ id, video_url }) as Episode;

describe('offline downloads', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    native.isNative = true;
  });

  it('downloads episodes to the app data folder and plays them locally', async () => {
    const progress = vi.fn();
    const size = await offline.downloadEpisodes('book-q', [ep('e1', 'https://cdn/e1.mp4'), ep('e2', '/media/e2.mp4'), ep('e3', '')], progress);
    expect(size).toBe(10);
    expect(fs.downloadFile).toHaveBeenCalledWith({ url: 'https://api.lamina.test/media/e2.mp4', path: 'downloads/book-q/e2.mp4', directory: 'DATA', recursive: true });
    expect(progress).toHaveBeenLastCalledWith(2, 2);
    expect(offline.offlineSrc('e1')).toBe('https://localhost/_capacitor_file_/data/downloads/book-q/e1.mp4');
    expect(offline.offlineSrc('e3')).toBeUndefined();

    // Already downloaded episodes are skipped
    await offline.downloadEpisodes('book-q', [ep('e1', 'https://cdn/e1.mp4')]);
    expect(fs.downloadFile).toHaveBeenCalledTimes(2);
  });

  it('removes a book\'s files', async () => {
    await offline.downloadEpisodes('book-q', [ep('e1', 'https://cdn/e1.mp4')]);
    await offline.removeBookDownloads('book-q');
    expect(fs.rmdir).toHaveBeenCalledWith({ path: 'downloads/book-q', directory: 'DATA', recursive: true });
    expect(offline.offlineSrc('e1')).toBeUndefined();
  });

  it('explains that downloads need the mobile app on the web', async () => {
    native.isNative = false;
    await expect(offline.downloadEpisodes('book-q', [ep('e1', 'x')])).rejects.toThrow(/app móvil/);
    expect(fs.downloadFile).not.toHaveBeenCalled();
  });
});
