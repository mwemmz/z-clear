import { describe, expect, it } from 'vitest';
import {
  checkDraft,
  hasBlockingFinding,
  isReviewTransition,
  REVIEW_POINT_EVENTS,
  REVIEW_TRANSITIONS,
  type DraftCheckInput,
} from './review';

function input(overrides: Partial<DraftCheckInput> = {}): DraftCheckInput {
  return {
    reference: 'REF-1',
    clientName: 'Kafue Metals Ltd',
    clientContact: 'imports@kafuemetals.example',
    type: 'import',
    origin: 'Durban',
    destination: 'Lusaka',
    consignment: {},
    importerTpin: null,
    ...overrides,
  };
}

describe('review transitions', () => {
  it('matches the lifecycle: draft sends, in_review queries/rends/approves, queried revises', () => {
    expect(isReviewTransition('draft', 'send')).toBe(true);
    expect(isReviewTransition('draft', 'query')).toBe(false);
    expect(isReviewTransition('in_review', 'approve')).toBe(true);
    expect(isReviewTransition('in_review', 'query')).toBe(true);
    expect(isReviewTransition('in_review', 'revise')).toBe(true);
    expect(isReviewTransition('queried', 'revise')).toBe(true);
    expect(isReviewTransition('queried', 'approve')).toBe(false);
    expect(REVIEW_TRANSITIONS.approved).toEqual([]);
  });

  it('is deterministic for identical inputs', () => {
    const one = checkDraft(input());
    const two = checkDraft(input());
    expect(one).toEqual(two);
  });

  it('flags a missing contact as the only blocking finding', () => {
    const findings = checkDraft(input({ clientContact: null }));
    expect(findings.map((f) => f.code)).toContain('missing_contact');
    expect(hasBlockingFinding(findings)).toBe(true);
  });

  it('warns on missing origin or destination without blocking', () => {
    const findings = checkDraft(input({ origin: null, destination: null }));
    expect(findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(['missing_origin', 'missing_destination']),
    );
    expect(hasBlockingFinding(findings)).toBe(false);
  });

  it('flags a TPIN format problem and a TPIN mismatch against the importer record', () => {
    const format = checkDraft(input({ consignment: { tpin: '12A45' } }));
    expect(format.map((f) => f.code)).toContain('tpin_format');

    const mismatch = checkDraft(
      input({ consignment: { tpin: '1001111222' }, importerTpin: '1009999999' }),
    );
    expect(mismatch.map((f) => f.code)).toContain('tpin_mismatch');
    expect(hasBlockingFinding(mismatch)).toBe(false);

    const matching = checkDraft(
      input({ consignment: { tpin: '1001111222' }, importerTpin: '1001111222' }),
    );
    expect(matching).toEqual([]);
  });

  it('ignores a TPIN on the shipment when the importer record has none', () => {
    const findings = checkDraft(input({ consignment: { tpin: '1001111222' } }));
    expect(findings.map((f) => f.code)).not.toContain('tpin_mismatch');
  });

  it('keeps point event values positive integers (internal engagement score only)', () => {
    for (const value of Object.values(REVIEW_POINT_EVENTS)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});
