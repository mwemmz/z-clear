/**
 * Ordered shipment pipeline. Note: customs declarations, duty assessment and
 * release physically happen in ASYCUDA World; these stages are the agent's
 * manual record of where the shipment has reached. Updates must stay one tap.
 */
export const SHIPMENT_STAGES = [
  'docs_received',
  'submitted',
  'duty_assessed',
  'duty_paid',
  'released',
  'in_transit',
  'delivered',
] as const;

export type ShipmentStage = (typeof SHIPMENT_STAGES)[number];

/** A shipment can leave the happy path and sit on hold with a reason. */
export const ON_HOLD_STAGE = 'on_hold' as const;

export type ShipmentStatus = ShipmentStage | typeof ON_HOLD_STAGE;

export const SHIPMENT_TYPES = ['import', 'export', 'transit'] as const;
export type ShipmentType = (typeof SHIPMENT_TYPES)[number];

export function isShipmentStage(value: string): value is ShipmentStage {
  return (SHIPMENT_STAGES as readonly string[]).includes(value);
}

/** Index in the happy path, or -1 for on_hold. Used for progress display. */
export function stageProgress(stage: ShipmentStatus): number {
  return isShipmentStage(stage) ? SHIPMENT_STAGES.indexOf(stage) : -1;
}
