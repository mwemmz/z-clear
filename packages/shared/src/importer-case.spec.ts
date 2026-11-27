import { describe, expect, it } from 'vitest';
import { caseConsignmentSchema, caseKindLabel } from './importer-case';

const vehicle = {
  caseKind: 'vehicle',
  vehicle: {
    make: 'Toyota',
    model: 'Hilux',
    year: 2022,
    vinOrChassis: 'AHTFR22C000000001',
    engine: '2GD-FTV',
    purchasePriceMinor: 1850000000,
    currency: 'ZMW',
    origin: 'Japan',
    portOfEntry: 'Ndola',
  },
};

const goods = {
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
};

describe('caseConsignmentSchema', () => {
  it('accepts typed vehicle details', () => {
    expect(caseConsignmentSchema.parse(vehicle)).toEqual(vehicle);
  });

  it('accepts typed goods details', () => {
    expect(caseConsignmentSchema.parse(goods)).toEqual(goods);
  });

  it('defaults currency to ZMW when omitted', () => {
    const parsed = caseConsignmentSchema.parse({
      ...goods,
      goods: { ...goods.goods, currency: undefined },
    });
    if (parsed.caseKind !== 'goods') throw new Error('expected goods case');
    expect(parsed.goods.currency).toBe('ZMW');
  });

  it('rejects a missing VIN/chassis, a non-integer price and unknown fields', () => {
    expect(
      caseConsignmentSchema.safeParse({
        ...vehicle,
        vehicle: { ...vehicle.vehicle, vinOrChassis: '' },
      }).success,
    ).toBe(false);
    expect(
      caseConsignmentSchema.safeParse({
        ...vehicle,
        vehicle: { ...vehicle.vehicle, purchasePriceMinor: 1.5 },
      }).success,
    ).toBe(false);
    expect(caseConsignmentSchema.safeParse({ ...vehicle, dutyRate: 16 }).success).toBe(false);
  });

  it('rejects a negative quantity and a malformed HS code', () => {
    expect(
      caseConsignmentSchema.safeParse({ ...goods, goods: { ...goods.goods, quantity: 0 } }).success,
    ).toBe(false);
    expect(
      caseConsignmentSchema.safeParse({ ...goods, goods: { ...goods.goods, hsCode: 'ABC' } })
        .success,
    ).toBe(false);
  });

  it('labels kinds for display without implying any assessment', () => {
    expect(caseKindLabel('vehicle')).toBe('Vehicle');
    expect(caseKindLabel('goods')).toBe('Goods');
  });
});
