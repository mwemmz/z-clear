import { describe, expect, it } from 'vitest';
import { recordedValuation, VALUATION_NOTICE } from './valuation';

describe('recordedValuation', () => {
  it('reads the value and description from a goods case', () => {
    expect(
      recordedValuation({
        caseKind: 'goods',
        goods: {
          description: 'Packaged maize flour',
          hsCode: '110220',
          quantity: 400,
          unit: 'bag',
          valueMinor: 32000000,
          currency: 'ZMW',
          origin: 'Zambia',
          portOfEntry: 'Lusaka',
        },
      }),
    ).toMatchObject({
      label: 'Value you recorded',
      description: 'Packaged maize flour',
      amountMinor: 32000000,
      currency: 'ZMW',
    });
  });

  it('reads the purchase price from a vehicle case', () => {
    const value = recordedValuation({
      caseKind: 'vehicle',
      vehicle: {
        make: 'Toyota',
        model: 'Hilux',
        year: 2022,
        vinOrChassis: 'AHTFR22C000000001',
        engine: '2GD-FTV',
        purchasePriceMinor: 185000000,
        currency: 'ZMW',
        origin: 'Japan',
        portOfEntry: 'Ndola',
      },
    });
    expect(value).toMatchObject({
      label: 'Purchase price you recorded',
      description: 'Toyota Hilux (2022)',
      amountMinor: 185000000,
    });
    expect(value?.formatted).toMatch(/1,850,000\.00/);
  });

  it('returns null for untyped or malformed consignments', () => {
    expect(recordedValuation({ goods: 'Maize' })).toBeNull();
    expect(recordedValuation(undefined)).toBeNull();
  });

  it('does not claim any customs decision in its notice', () => {
    expect(VALUATION_NOTICE).toContain('not a customs assessment');
    expect(VALUATION_NOTICE).toContain('ASYCUDA World');
    expect(VALUATION_NOTICE).not.toMatch(/duty is|vat is/i);
  });
});
