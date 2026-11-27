import { describe, expect, it } from 'vitest';
import type { TariffRule } from './compliance';
import {
  COMPLIANCE_ASSISTANT_NOTICE,
  COMPLIANCE_ESTIMATE_NOTICE,
  compliancePrompts,
  estimateFromRules,
} from './compliance';

const verified: TariffRule = {
  hsCode: '1102200000',
  description: 'Synthetic verified test rule',
  rateBp: 500,
  sourceUrl: 'https://example.com/verified-source',
  effectiveDate: '2026-01-01',
  verificationStatus: 'VERIFIED',
};

const needsVerification: TariffRule = {
  ...verified,
  description: 'Synthetic unverified test rule',
  verificationStatus: 'NEEDS_VERIFICATION',
};

const sample: TariffRule = {
  ...verified,
  description: 'SAMPLE ONLY — not a real tariff',
  verificationStatus: 'SAMPLE',
};

describe('estimateFromRules', () => {
  const input = { hsCode: '1102200000', customsValueMinor: 1_000_000, currency: 'ZMW' };

  it('uses a VERIFIED rule and carries its source and verification status', () => {
    const result = estimateFromRules(input, [needsVerification, verified], { allowSample: false });
    expect(result.kind).toBe('estimate');
    if (result.kind !== 'estimate') return;
    expect(result).toMatchObject({
      amountMinor: 50_000,
      basis: 'VERIFIED',
      rateBp: 500,
      currency: 'ZMW',
      rule: {
        sourceUrl: 'https://example.com/verified-source',
        effectiveDate: '2026-01-01',
        verificationStatus: 'VERIFIED',
      },
    });
    expect(result.notice).toContain('ASYCUDA World');
  });

  it('never uses a NEEDS_VERIFICATION or SUPERSEDED rule', () => {
    for (const status of ['NEEDS_VERIFICATION', 'SUPERSEDED'] as const) {
      const result = estimateFromRules(input, [{ ...verified, verificationStatus: status }], {
        allowSample: false,
      });
      expect(result).toMatchObject({ kind: 'refused', reason: 'no_verified_rule' });
    }
  });

  it('refuses a SAMPLE rule unless demo mode is explicitly enabled', () => {
    expect(estimateFromRules(input, [sample], { allowSample: false })).toMatchObject({
      kind: 'refused',
      reason: 'sample_mode_disabled',
    });
    const result = estimateFromRules(input, [sample], { allowSample: true });
    expect(result.kind).toBe('estimate');
    if (result.kind !== 'estimate') return;
    expect(result.basis).toBe('SAMPLE');
    expect(result.rule.description).toContain('SAMPLE ONLY');
  });

  it('prefers a VERIFIED rule over a SAMPLE rule when both match', () => {
    const result = estimateFromRules(input, [sample, verified], { allowSample: true });
    expect(result.kind).toBe('estimate');
    if (result.kind !== 'estimate') return;
    expect(result.basis).toBe('VERIFIED');
  });

  it('does not match an unrelated HS code', () => {
    expect(
      estimateFromRules({ ...input, hsCode: '9999990000' }, [verified], { allowSample: true }),
    ).toMatchObject({ kind: 'refused', reason: 'no_verified_rule' });
  });

  it('refuses malformed input without computing an amount', () => {
    for (const bad of [
      { ...input, hsCode: 'abc' },
      { ...input, currency: 'dollars' },
      { ...input, customsValueMinor: -1 },
      { ...input, customsValueMinor: 1.5 },
    ]) {
      expect(estimateFromRules(bad, [verified], { allowSample: true })).toMatchObject({
        kind: 'refused',
        reason: 'invalid_input',
      });
    }
  });

  it('keeps the non-assessment notice on every outcome', () => {
    expect(COMPLIANCE_ESTIMATE_NOTICE).toContain('does not assess duty');
    expect(COMPLIANCE_ESTIMATE_NOTICE).toContain('Do not pay or file');
  });
});

describe('compliancePrompts', () => {
  it('only turns configured agency guidance into questions and carries provenance', () => {
    const prompts = compliancePrompts({
      caseKind: 'goods',
      recordedValueFormatted: 'K 320,000.00',
      rules: [
        {
          docType: 'invoice',
          label: 'Commercial invoice',
          isMandatory: true,
          sortOrder: 1,
          caseKind: null,
          sourceUrl: 'https://example.com/agency-note',
          effectiveDate: '2026-01-01',
          verificationStatus: 'NEEDS_VERIFICATION',
          satisfied: false,
        },
        {
          docType: 'vehicle-title',
          label: 'Vehicle title',
          isMandatory: true,
          sortOrder: 2,
          caseKind: 'vehicle',
          sourceUrl: null,
          effectiveDate: null,
          verificationStatus: 'VERIFIED',
          satisfied: false,
        },
      ],
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toMatchObject({
      id: 'agency:invoice',
      origin: 'agency_requirement',
      verificationStatus: 'NEEDS_VERIFICATION',
      sourceUrl: 'https://example.com/agency-note',
    });
    expect(prompts[0]?.text).toContain('Confirm with your agency');
    expect(prompts.map((prompt) => prompt.id)).not.toContain('agency:vehicle-title');
    expect(prompts[1]).toMatchObject({ id: 'case:recorded-value', origin: 'case_fact' });
  });

  it('does not describe prompts as legal requirements', () => {
    expect(COMPLIANCE_ASSISTANT_NOTICE).toContain('not legal advice');
    expect(COMPLIANCE_ASSISTANT_NOTICE).toContain('ASYCUDA World');
  });
});
