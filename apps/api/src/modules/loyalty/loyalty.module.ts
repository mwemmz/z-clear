import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

/**
 * Tenant-scoped, read-only loyalty structure. DatabaseService is global, and
 * there are no state-changing routes to audit until verified rules exist.
 */
@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
