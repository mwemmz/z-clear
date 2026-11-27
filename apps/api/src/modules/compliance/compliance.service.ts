import { Inject, Injectable } from '@nestjs/common';
import {
  COMPLIANCE_ASSISTANT_NOTICE,
  compliancePrompts,
  estimateFromRules,
  recordedValuation,
} from '@zclear/shared';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { CasesService } from '../cases/cases.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { ComplianceWordingService } from './compliance-wording.service';
import { TariffRulesProvider } from './tariff-rules.provider';
import type { ComplianceAssistant, ComplianceEstimate, EstimateRequest } from './compliance.dto';

/**
 * Importer-facing compliance assistant and illustrative estimator.
 *
 * The assistant reuses the importer-scoped checklist, so another importer's
 * case cannot be read. The estimator uses only external VERIFIED rule data (or
 * explicitly enabled SAMPLE data) through a pure helper. Nothing here assesses
 * duty, decides compliance or talks to ASYCUDA World.
 */
@Injectable()
export class ComplianceService {
  constructor(
    private readonly cases: CasesService,
    private readonly shipments: ShipmentsService,
    private readonly rules: TariffRulesProvider,
    private readonly wording: ComplianceWordingService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async assistant(
    tenantId: string,
    actorUserId: string,
    caseId: string,
  ): Promise<ComplianceAssistant> {
    const shipment = await this.shipments.get(tenantId, caseId, {
      role: 'client_viewer',
      userId: actorUserId,
    });
    const checklist = await this.cases.checklist(tenantId, actorUserId, caseId);
    const recorded = recordedValuation(shipment.consignment);

    const prompts = compliancePrompts({
      rules: checklist.rules,
      caseKind: checklist.caseKind,
      recordedValueFormatted: recorded?.formatted ?? null,
    });
    const rewording = this.wording.reword(prompts);

    return {
      caseId,
      prompts: rewording.prompts,
      wordingSource: rewording.source,
      notice: COMPLIANCE_ASSISTANT_NOTICE,
    };
  }

  estimate(input: EstimateRequest): ComplianceEstimate {
    return estimateFromRules(input, this.rules.all(), {
      allowSample: this.env.COMPLIANCE_SAMPLE_MODE,
    });
  }
}
