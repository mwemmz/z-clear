import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ComplianceWordingService } from './compliance-wording.service';
import { TariffRulesProvider } from './tariff-rules.provider';

@Module({
  imports: [CasesModule, ShipmentsModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceWordingService, TariffRulesProvider],
})
export class ComplianceModule {}
