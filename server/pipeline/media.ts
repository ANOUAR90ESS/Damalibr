import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Where generated audio, images and videos are stored. */
export interface MediaStore {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  /** Returns a short-lived URL for direct client access when supported. */
  getSignedUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}

const safeKey = (key: string) => {
  const normalized = path.posix.normalize(key).replace(/^\/+/, '');
  if (normalized.startsWith('..')) throw new Error(`Ruta de medio inválida: ${key}`);
  return normalized;
};

/** Local disk, served through the authenticated /api/media endpoint in production. */
export class LocalMediaStore implements MediaStore {
  constructor(private dir: string, private publicPrefix = '/media') {}

  async put(key: string, data: Buffer, _contentType: string): Promise<string> {
    const k = safeKey(key);
    const file = path.join(this.dir, k);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return `${this.publicPrefix}/${k}`;
  }

  read(key: string): Promise<Buffer> {
    return readFile(path.join(this.dir, safeKey(key)));
  }
}

/** Supabase Storage private bucket (production). */
export class SupabaseMediaStore implements MediaStore {
  constructor(private admin: SupabaseClient, private bucket = 'media') {}

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const k = safeKey(key);
    const { error } = await this.admin.storage.from(this.bucket).upload(k, data, {
      contentType,
      upsert: true,
    });
    if (error) throw error;

    // Never expose a permanent public Storage URL. The bucket is private.
    return `/api/media?key=${encodeURIComponent(k)}`;
  }

  async read(key: string): Promise<Buffer> {
    const { data, error } = await this.admin.storage.from(this.bucket).download(safeKey(key));
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async getSignedUrl(key: string, expiresInSeconds = 120): Promise<string> {
    const { data, error } = await this.admin.storage
      .from(this.bucket)
      .createSignedUrl(safeKey(key), expiresInSeconds);

    if (error || !data?.signedUrl) throw error || new Error('No se pudo crear la URL firmada.');
    return data.signedUrl;
  }
}
