import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

/**
 * Root module. Phase 0 wires only configuration and health.
 *
 * Phase 1+ modules (auth, tenants, users, shipments, documents, tariffs,
 * quotes, invoices, exports, notifications, public_status, audit, files, jobs)
 * are added here as each phase lands. The `integrations/` boundary is reserved
 * for a future ASYCUDA/ZRA link and stays empty until approved.
 */
@Module({
  imports: [AppConfigModule, HealthModule],
})
export class AppModule {}
