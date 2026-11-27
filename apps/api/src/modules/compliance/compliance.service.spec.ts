import { describe, expect, it, vi } from 'vitest';
import type { CompliancePrompt, TariffRule } from '@zclear/shared';
import { loadEnv } from '../../config/env';
import type { CasesService } from '../cases/cases.service';
import type { ShipmentsService } from '../shipments/shipments.service';
import { ComplianceWordingService } from './compliance-wording.service';
import { ComplianceService } from './compliance.service';
import type { TariffRulesProvider } from './tariff-rules.provider';

const verified: TariffRule = {
  hsCode: '1102200000',
  description: 'Synthetic verified test rule',
  rateBp: 500,
  sourceUrl: 'https://example.com/source',
  effectiveDate: '2026-01-01',
  verificationStatus: 'VERIFIED',
};
const sample: TariffRule = { ...verified, verificationStatus: 'SAMPLE' };

function service(rules: TariffRule[], sampleMode: boolean): ComplianceService {
  return new ComplianceService(
    {} as CasesService,
    {} as ShipmentsService,
    { all: () => rules } as unknown as TariffRulesProvider,
    new ComplianceWordingService(loadEnv({})),
    { ...loadEnv({}), COMPLIANCE_SAMPLE_MODE: sampleMode },
  );
}

describe('ComplianceService.estimate', () => {
  const input = { hsCode: '1102200000', customsValueMinor: 1_000_000, currency: 'ZMW' as const };

  it('refuses when no rule is configured', () => {
    expect(service([], false).estimate(input)).toMatchObject({
      kind: 'refused',
      reason: 'no_verified_rule',
    });
  });

  it('uses a VERIFIED rule and refuses a SAMPLE rule while demo mode is off', () => {
    expect(service([verified], false).estimate(input)).toMatchObject({
      kind: 'estimate',
      basis: 'VERIFIED',
    });
    expect(service([sample], false).estimate(input)).toMatchObject({
      kind: 'refused',
      reason: 'sample_mode_disabled',
    });
  });

  it('labels a SAMPLE estimate when demo mode is explicitly enabled', () => {
    const result = service([sample], true).estimate(input);
    expect(result).toMatchObject({ kind: 'estimate', basis: 'SAMPLE' });
    if (result.kind !== 'estimate') return;
    expect(result.notice).toContain('Do not pay or file');
  });
});

describe('ComplianceWordingService', () => {
  const prompts: CompliancePrompt[] = [
    {
      id: 'agency:invoice',
      text: 'Confirm with your agency: Commercial invoice.',
      origin: 'agency_requirement',
      verificationStatus: 'NEEDS_VERIFICATION',
      sourceUrl: 'https://example.com/source',
      effectiveDate: '2026-01-01',
    },
  ];

  it('returns deterministic wording even when FEATURE_AI is on but no model is wired', () => {
    for (const featureAi of [false, true]) {
      const service = new ComplianceWordingService({ ...loadEnv({}), FEATURE_AI: featureAi });
      expect(service.reword(prompts)).toEqual({ prompts, source: 'fixed' });
    }
  });
});

describe('ComplianceService.assistant', () => {
  it('maps scoped checklist rules into labelled prompts with a fixed notice', async () => {
    const shipments = {
      get: vi.fn().mockResolvedValue({ consignment: { caseKind: 'goods' } }),
    } as unknown as ShipmentsService;
    const cases = {
      checklist: vi.fn().mockResolvedValue({
        caseKind: 'goods',
        rules: [
          {
            docType: 'invoice',
            label: 'Commercial invoice',
            sortOrder: 1,
            caseKind: null,
            sourceUrl: 'https://example.com/source',
            effectiveDate: '2026-01-01',
            verificationStatus: 'NEEDS_VERIFICATION',
            satisfied: false,
          },
        ],
      }),
    } as unknown as CasesService;
    const service = new ComplianceService(
      cases,
      shipments,
      { all: () => [] } as unknown as TariffRulesProvider,
      new ComplianceWordingService(loadEnv({})),
      loadEnv({}),
    );

    const result = await service.assistant('tenant', 'user', 'case');
    expect(result.caseId).toBe('case');
    expect(result.wordingSource).toBe('fixed');
    expect(result.notice).toContain('not legal advice');
    expect(result.prompts).toMatchObject([
      { id: 'agency:invoice', verificationStatus: 'NEEDS_VERIFICATION' },
    ]);
  });
});
