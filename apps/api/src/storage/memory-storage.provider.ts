import { Readable } from 'node:stream';
import type { StorageProvider, StoredObject } from './storage.types';

/**
 * In-process object store for development and tests. Contents live only for the
 * lifetime of the process, so it is never used in production.
 */
export class MemoryStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<StoredObject> {
    const object = this.objects.get(key);
    if (!object) throw new Error(`object not found: ${key}`);
    return {
      body: Readable.from(object.body),
      contentType: object.contentType,
      contentLength: object.body.byteLength,
    };
  }

  async remove(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async signedDownloadUrl(): Promise<string | null> {
    return null;
  }
}
