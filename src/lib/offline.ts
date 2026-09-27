import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Episode } from '../types';
import { isNative, mediaUrl } from './platform';
import { storageService } from './supabase';

// Offline viewing: the native app saves episode MP4s in its private data folder.

interface OfflineFile {
  bookId: string;
  uri: string;
  sizeMb: number;
}

const KEY = 'offline_files';
const files = () => storageService.get<Record<string, OfflineFile>>(KEY, {});

export const OFFLINE_WEB_MESSAGE = 'Las descargas sin conexión están disponibles en la app móvil de Lámina.';

/** Local playable URL of a downloaded episode, if any. */
export function offlineSrc(episodeId: string): string | undefined {
  const file = files()[episodeId];
  return file ? Capacitor.convertFileSrc(file.uri) : undefined;
}

/**
 * Downloads the given episodes (callers pass only episodes the user can already
 * watch). Returns the total size on disk in MB.
 */
export async function downloadEpisodes(
  bookId: string,
  episodes: Episode[],
  onProgress: (done: number, total: number) => void = () => {},
): Promise<number> {
  if (!isNative) throw new Error(OFFLINE_WEB_MESSAGE);
  const downloadable = episodes.filter(ep => ep.video_url);
  if (!downloadable.length) throw new Error('No hay episodios disponibles para descargar.');

  const saved = files();
  let done = 0;
  onProgress(done, downloadable.length);
  for (const ep of downloadable) {
    if (!saved[ep.id]) {
      const path = `downloads/${bookId}/${ep.id}.mp4`;
      await Filesystem.downloadFile({ url: mediaUrl(ep.video_url)!, path, directory: Directory.Data, recursive: true });
      const [{ uri }, { size }] = await Promise.all([
        Filesystem.getUri({ path, directory: Directory.Data }),
        Filesystem.stat({ path, directory: Directory.Data }),
      ]);
      saved[ep.id] = { bookId, uri, sizeMb: size / (1024 * 1024) };
      storageService.set(KEY, saved);
    }
    onProgress(++done, downloadable.length);
  }

  return Object.values(saved).filter(f => f.bookId === bookId).reduce((t, f) => t + f.sizeMb, 0);
}

export async function removeBookDownloads(bookId: string): Promise<void> {
  if (isNative) {
    await Filesystem.rmdir({ path: `downloads/${bookId}`, directory: Directory.Data, recursive: true }).catch(() => {});
  }
  const remaining = Object.fromEntries(Object.entries(files()).filter(([, f]) => f.bookId !== bookId));
  storageService.set(KEY, remaining);
}
