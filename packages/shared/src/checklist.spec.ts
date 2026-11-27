import { describe, expect, it } from 'vitest';
import { personaliseChecklist, type ChecklistRule } from './checklist';

function rule(overrides: Partial<ChecklistRule> = {}): ChecklistRule {
  return {
    docType: 'proof_of_purchase',
    label: 'Proof of purchase',
    isMandatory: true,
    sortOrder: 0,
    caseKind: null,
    sourceUrl: null,
    effectiveDate: null,
    verificationStatus: 'NEEDS_VERIFICATION',
    satisfied: false,
    ...overrides,
  };
}

describe('personaliseChecklist', () => {
  it('keeps rules for all cases and the matching case kind only', () => {
    const result = personaliseChecklist(
      [
        rule({ docType: 'all', caseKind: null }),
        rule({ docType: 'vehicle_only', caseKind: 'vehicle' }),
        rule({ docType: 'goods_only', caseKind: 'goods' }),
      ],
      'vehicle',
    );
    expect(result.rules.map((item) => item.docType)).toEqual(['all', 'vehicle_only']);
    expect(result.caseKind).toBe('vehicle');
  });

  it('sorts by sort order then doc type and lists only missing mandatory items', () => {
    const result = personaliseChecklist(
      [
        rule({ docType: 'z_last', sortOrder: 2, isMandatory: false }),
        rule({ docType: 'a_missing', sortOrder: 1, satisfied: false }),
        rule({ docType: 'b_done', sortOrder: 1, satisfied: true }),
      ],
      'goods',
    );
    expect(result.rules.map((item) => item.docType)).toEqual(['a_missing', 'b_done', 'z_last']);
    expect(result.missingMandatory).toEqual(['a_missing']);
  });

  it('flags any unverified rule and always shows the fixed disclosure', () => {
    const unverified = personaliseChecklist([rule()], 'goods');
    expect(unverified.hasUnverifiedRules).toBe(true);
    expect(unverified.notice).toMatch(/not official requirements/);

    const verified = personaliseChecklist(
      [rule({ verificationStatus: 'VERIFIED', sourceUrl: 'https://example.com/source' })],
      'goods',
    );
    expect(verified.hasUnverifiedRules).toBe(false);
    expect(verified.rules.at(0)?.sourceUrl).toBe('https://example.com/source');
  });

  it('treats a superseded rule as unverified', () => {
    const result = personaliseChecklist([rule({ verificationStatus: 'SUPERSEDED' })], 'vehicle');
    expect(result.hasUnverifiedRules).toBe(true);
  });

  it('returns an empty, clearly-labelled checklist when nothing is configured', () => {
    const result = personaliseChecklist([], 'vehicle');
    expect(result.rules).toEqual([]);
    expect(result.missingMandatory).toEqual([]);
    expect(result.hasUnverifiedRules).toBe(false);
    expect(result.notice).toMatch(/agency guidance/);
  });
});
