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

/** Every status a shipment can be in, including the off-pipeline hold state. */
export const SHIPMENT_STATUSES = [...SHIPMENT_STAGES, ON_HOLD_STAGE] as const;

export const SHIPMENT_TYPES = ['import', 'export', 'transit'] as const;
export type ShipmentType = (typeof SHIPMENT_TYPES)[number];

export function isShipmentStage(value: string): value is ShipmentStage {
  return (SHIPMENT_STAGES as readonly string[]).includes(value);
}

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

export function isShipmentType(value: string): value is ShipmentType {
  return (SHIPMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Human labels for staff-facing UI. Kept here so API and web never drift, and
 * so labels can be made per-agency config later without moving them out of code.
 */
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  docs_received: 'Documents received',
  submitted: 'Submitted to customs',
  duty_assessed: 'Duty assessed',
  duty_paid: 'Duty paid',
  released: 'Released',
  in_transit: 'In transit',
  delivered: 'Delivered',
  on_hold: 'On hold',
};

/** Index in the happy path, or -1 for on_hold. Used for progress display. */
export function stageProgress(stage: ShipmentStatus): number {
  return isShipmentStage(stage) ? SHIPMENT_STAGES.indexOf(stage) : -1;
}
