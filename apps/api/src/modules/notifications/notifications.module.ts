import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_PROVIDER_TOKEN, notificationProviderFromEnv } from './notification.provider';
import { NotificationsService } from './notifications.service';

/** Global so billing and reviews can emit without re-importing configuration. */
@Global()
@Module({
  imports: [AuditModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: NOTIFICATION_PROVIDER_TOKEN,
      inject: [APP_ENV],
      useFactory: notificationProviderFromEnv,
    },
  ],
  exports: [NotificationsService, NOTIFICATION_PROVIDER_TOKEN],
})
export class NotificationsModule {}
