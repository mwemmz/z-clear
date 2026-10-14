import { describe, expect, it } from 'vitest';
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  isShipmentStage,
  isShipmentStatus,
  isShipmentType,
  stageProgress,
} from './shipment-stage';

describe('shipment stages', () => {
  it('recognises valid stages', () => {
    expect(isShipmentStage('released')).toBe(true);
    expect(stageProgress('delivered')).toBeGreaterThan(stageProgress('submitted'));
  });

  it('returns -1 for on_hold and unknown values', () => {
    expect(stageProgress('on_hold')).toBe(-1);
    expect(isShipmentStage('nonsense')).toBe(false);
  });

  it('treats on_hold as a valid status but not a stage', () => {
    expect(isShipmentStatus('on_hold')).toBe(true);
    expect(isShipmentStage('on_hold')).toBe(false);
    expect(SHIPMENT_STATUSES).toContain('on_hold');
    expect(SHIPMENT_STATUSES).toHaveLength(SHIPMENT_STAGES.length + 1);
  });

  it('labels every status so the UI can never render an id', () => {
    for (const status of SHIPMENT_STATUSES) {
      expect(SHIPMENT_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('validates shipment types', () => {
    expect(isShipmentType('import')).toBe(true);
    expect(isShipmentType('transit')).toBe(true);
    expect(isShipmentType('smuggle')).toBe(false);
  });
});
