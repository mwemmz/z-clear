import { describe, expect, it } from 'vitest';
import { isShipmentStage, stageProgress } from './shipment-stage';

describe('shipment stages', () => {
  it('recognises valid stages', () => {
    expect(isShipmentStage('released')).toBe(true);
    expect(stageProgress('delivered')).toBeGreaterThan(stageProgress('submitted'));
  });

  it('returns -1 for on_hold and unknown values', () => {
    expect(stageProgress('on_hold')).toBe(-1);
    expect(isShipmentStage('nonsense')).toBe(false);
  });
});
