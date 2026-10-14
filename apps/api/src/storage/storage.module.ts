import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../config/config.module';
import type { AppEnv } from '../config/env';
import { MemoryStorageProvider } from './memory-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { NoopScanProvider, SCAN_PROVIDER } from './scan.provider';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.types';

/**
 * Private object storage + malware-scan seams. Global so domain modules can
 * inject them without re-importing. The driver is chosen by config, never by
 * code branching at call sites.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [APP_ENV],
      useFactory: (env: AppEnv): StorageProvider =>
        env.STORAGE_DRIVER === 's3' ? new S3StorageProvider(env) : new MemoryStorageProvider(),
    },
    { provide: SCAN_PROVIDER, useClass: NoopScanProvider },
  ],
  exports: [STORAGE_PROVIDER, SCAN_PROVIDER],
})
export class StorageModule {}
