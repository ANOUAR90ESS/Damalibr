import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Where generated audio, images and videos are stored. */
export interface MediaStore {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  read(key: string): Promise<Buffer>;
}

const safeKey = (key: string) => {
  const normalized = path.posix.normalize(key).replace(/^\/+/, '');
  if (normalized.startsWith('..')) throw new Error(`Ruta de medio inválida: ${key}`);
  return normalized;
};

/** Local disk, served by Express at `publicPrefix` (development / demo mode). */
export class LocalMediaStore implements MediaStore {
  constructor(private dir: string, private publicPrefix = '/media') {}

  async put(key: string, data: Buffer): Promise<string> {
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

/** Supabase Storage public bucket (production). */
export class SupabaseMediaStore implements MediaStore {
  constructor(private admin: SupabaseClient, private bucket = 'media') {}

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const k = safeKey(key);
    const { error } = await this.admin.storage.from(this.bucket).upload(k, data, { contentType, upsert: true });
    if (error) throw error;
    return this.admin.storage.from(this.bucket).getPublicUrl(k).data.publicUrl;
  }

  async read(key: string): Promise<Buffer> {
    const { data, error } = await this.admin.storage.from(this.bucket).download(safeKey(key));
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }
}
