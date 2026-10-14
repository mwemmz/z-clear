import type { Readable } from 'node:stream';

export interface StoredObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

/**
 * Private object storage. Every upload is tenant-namespaced by key. Drivers must
 * never expose objects publicly; downloads always pass an authorization check
 * first (either a presigned URL minted after authz, or a stream through the API).
 */
export interface StorageProvider {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  remove(key: string): Promise<void>;
  /**
   * A short-lived presigned URL, or `null` when the driver has no URL concept
   * and the API should stream the object itself after authorization.
   */
  signedDownloadUrl(key: string, expiresInSeconds: number): Promise<string | null>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
