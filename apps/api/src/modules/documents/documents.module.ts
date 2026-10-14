import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { AuthModule } from '../auth/auth.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({
        limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
