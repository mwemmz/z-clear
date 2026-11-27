import type { ShipmentStatus, ShipmentType } from '@zclear/shared';

/**
 * Stable, one-way export artifact. This is data for an agent to key into
 * ASYCUDA World by hand; it is not a submission and there is no live link.
 */
export interface HandoffExport {
  schemaVersion: 'zclear.handoff.v1';
  generatedAt: string;
  shipment: {
    id: string;
    reference: string;
    clientName: string;
    clientContact: string | null;
    type: ShipmentType;
    stage: ShipmentStatus;
    holdReason: string | null;
    origin: string | null;
    destination: string | null;
    consignment: Record<string, unknown>;
  };
  events: Array<{
    fromStage: ShipmentStatus | null;
    toStage: ShipmentStatus;
    note: string | null;
    source: string;
    createdAt: string;
  }>;
  invoice: null | {
    number: string;
    currency: string;
    status: string;
    totalMinor: number;
    vatRateBp: number;
    vatVerificationStatus: string;
    lines: Array<{
      chargeType: string;
      description: string;
      quantity: number;
      lineAmountMinor: number;
      taxMinor: number;
    }>;
  };
  notes: string[];
}
