import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AccessGuard } from './modules/policy/access.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Root module. Guard order matters: throttling runs before authentication so
 * the login endpoint is protected from brute force.
 *
 * Phase 2+ modules (shipments, documents, tariffs, quotes, invoices, exports,
 * notifications, public_status, files, jobs) land here. The `integrations/`
 * boundary stays empty until an ASYCUDA/ZRA link is explicitly approved.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuditModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ShipmentsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule {}
