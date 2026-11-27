import { describe, expect, it } from 'vitest';
import { caseStatusAnswers, CASE_STATUS_NOTICE } from './case-status';

describe('caseStatusAnswers', () => {
  it('answers all four importer questions from the stage, hold and recorded invoices', () => {
    const answers = caseStatusAnswers({
      stage: 'on_hold',
      holdReason: 'Waiting for a signed proof of purchase',
      invoices: [
        {
          number: 'INV-1',
          status: 'partially_paid',
          currency: 'ZMW',
          balanceMinor: 50000,
        },
      ],
      missingMandatory: 1,
    });

    expect(answers.map((item) => item.question)).toEqual([
      'Where is my case?',
      'Do you need anything from me?',
      'What do I owe?',
      'What happens next?',
    ]);
    expect(answers[0]?.answer).toContain('On hold');
    expect(answers[1]?.answer).toContain('Waiting for a signed proof of purchase');
    expect(answers[2]?.answer).toMatch(/500\.00/);
    expect(answers[2]?.answer).toContain('not a ZRA assessment');
    expect(answers[3]?.answer).toContain('when the hold is resolved');
    expect(CASE_STATUS_NOTICE).toContain('ASYCUDA World');
  });

  it('says no invoice exists when none has been issued', () => {
    const answers = caseStatusAnswers({
      stage: 'docs_received',
      holdReason: null,
      invoices: [],
      missingMandatory: 0,
    });
    expect(answers[2]?.answer).toBe('No invoice has been issued for this case yet.');
  });

  it('ignores voided invoices and reports no unpaid balance', () => {
    const answers = caseStatusAnswers({
      stage: 'delivered',
      holdReason: null,
      invoices: [
        { number: 'VOID-1', status: 'void', currency: 'ZMW', balanceMinor: 99900 },
        { number: 'INV-2', status: 'paid', currency: 'ZMW', balanceMinor: 0 },
      ],
      missingMandatory: 0,
    });
    expect(answers[2]?.answer).toBe('No unpaid invoice balance is recorded.');
    expect(answers[3]?.answer).toBe('No further stage is recorded for this case.');
  });

  it('uses singular wording for one missing checklist item', () => {
    const answers = caseStatusAnswers({
      stage: 'submitted',
      holdReason: null,
      invoices: [],
      missingMandatory: 1,
    });
    expect(answers[1]?.answer).toContain('1 item still needed');
  });
});
