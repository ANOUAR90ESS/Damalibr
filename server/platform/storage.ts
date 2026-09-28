export type MediaKind = 'image' | 'audio' | 'video' | 'subtitle' | 'thumbnail' | 'export' | 'other';

export interface MediaObject {
  key: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}

export interface MediaStorage {
  put(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
}

/** Storage is intentionally key-based; protected media should use short-lived access URLs. */
export function mediaKey(projectId: string, kind: MediaKind, id: string, extension: string) {
  const ext = extension.replace(/^\./, '');
  return 'projects/' + projectId + '/' + kind + '/' + id + '.' + ext;
}
