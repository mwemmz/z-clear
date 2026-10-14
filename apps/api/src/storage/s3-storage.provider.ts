import type { Readable } from 'node:stream';
import type { AppEnv } from '../config/env';
import type { StorageProvider, StoredObject } from './storage.types';

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, MinIO...). The SDK is imported
 * lazily so the `memory` driver and the test suite never load it. Buckets must
 * be private; access is always via short-lived presigned URLs minted after an
 * authorization check.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;

  constructor(private readonly env: AppEnv) {
    if (!env.S3_BUCKET) {
      throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
    }
    this.bucket = env.S3_BUCKET;
  }

  private async sdk() {
    return import('@aws-sdk/client-s3');
  }

  private async client() {
    const { S3Client } = await this.sdk();
    return new S3Client({
      region: this.env.S3_REGION,
      endpoint: this.env.S3_ENDPOINT,
      forcePathStyle: this.env.S3_FORCE_PATH_STYLE,
      credentials: this.env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: this.env.S3_ACCESS_KEY_ID,
            secretAccessKey: this.env.S3_SECRET_ACCESS_KEY ?? '',
          }
        : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { PutObjectCommand } = await this.sdk();
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    client.destroy();
  }

  async get(key: string): Promise<StoredObject> {
    const { GetObjectCommand } = await this.sdk();
    const client = await this.client();
    const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) {
      client.destroy();
      throw new Error(`object not found: ${key}`);
    }
    const body = response.Body as Readable;
    // The stream owns the connection until it is fully read; destroy the client
    // when it finishes or errors.
    body.once('close', () => client.destroy());
    body.once('error', () => client.destroy());
    return {
      body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  }

  async remove(key: string): Promise<void> {
    const { DeleteObjectCommand } = await this.sdk();
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    client.destroy();
  }

  async signedDownloadUrl(key: string, expiresInSeconds: number): Promise<string | null> {
    const { GetObjectCommand } = await this.sdk();
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.client();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
    client.destroy();
    return url;
  }
}
