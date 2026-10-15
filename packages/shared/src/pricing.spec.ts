import { describe, expect, it } from 'vitest';
import { paymentStatusFor, outstandingMinor, priceLines, taxOnAmount } from './pricing';

describe('taxOnAmount', () => {
  it('applies basis points with integer rounding', () => {
    expect(taxOnAmount(10_000, 1600)).toBe(1_600);
    expect(taxOnAmount(999, 1600)).toBe(160);
    expect(taxOnAmount(0, 1600)).toBe(0);
  });

  it('rejects non-integer input', () => {
    expect(() => taxOnAmount(10.5, 1600)).toThrow();
    expect(() => taxOnAmount(100, 16.5)).toThrow();
  });
});

describe('priceLines', () => {
  it('taxes only the service fee and leaves pass-throughs untouched', () => {
    const totals = priceLines(
      [
        {
          chargeType: 'customs_duty',
          description: 'Duty',
          quantity: 1,
          unitAmountMinor: 500_000,
          isTaxable: false,
        },
        {
          chargeType: 'agency_fee',
          description: 'Clearance fee',
          quantity: 1,
          unitAmountMinor: 100_000,
          isTaxable: true,
        },
      ],
      1600,
    );

    expect(totals.lines[0]).toMatchObject({ lineAmountMinor: 500_000, taxMinor: 0 });
    expect(totals.lines[1]).toMatchObject({ lineAmountMinor: 100_000, taxMinor: 16_000 });
    expect(totals.subtotalMinor).toBe(600_000);
    expect(totals.taxMinor).toBe(16_000);
    expect(totals.totalMinor).toBe(616_000);
  });

  it('multiplies unit price by whole-unit quantity', () => {
    const totals = priceLines(
      [
        {
          chargeType: 'transport',
          description: 'Trips',
          quantity: 3,
          unitAmountMinor: 25_000,
          isTaxable: false,
        },
      ],
      1600,
    );
    expect(totals.lines[0]!.lineAmountMinor).toBe(75_000);
    expect(totals.totalMinor).toBe(75_000);
  });

  it('rejects fractional or non-positive quantities', () => {
    expect(() =>
      priceLines(
        [
          {
            chargeType: 'transport',
            description: 'x',
            quantity: 1.5,
            unitAmountMinor: 100,
            isTaxable: false,
          },
        ],
        1600,
      ),
    ).toThrow();
    expect(() =>
      priceLines(
        [
          {
            chargeType: 'transport',
            description: 'x',
            quantity: 0,
            unitAmountMinor: 100,
            isTaxable: false,
          },
        ],
        1600,
      ),
    ).toThrow();
  });

  it('handles an empty line set', () => {
    expect(priceLines([], 1600)).toEqual({
      lines: [],
      subtotalMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
    });
  });
});

describe('paymentStatusFor', () => {
  it('classifies unpaid, partial and paid, and tolerates overpayment', () => {
    expect(paymentStatusFor(1000, 0)).toBe('unpaid');
    expect(paymentStatusFor(1000, 400)).toBe('partially_paid');
    expect(paymentStatusFor(1000, 1000)).toBe('paid');
    expect(paymentStatusFor(1000, 1500)).toBe('paid');
  });
});

describe('outstandingMinor', () => {
  it('never reports a negative balance', () => {
    expect(outstandingMinor(1000, 400)).toBe(600);
    expect(outstandingMinor(1000, 1000)).toBe(0);
    expect(outstandingMinor(1000, 1500)).toBe(0);
  });
});
