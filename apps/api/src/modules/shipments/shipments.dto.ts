import { z } from 'zod';
import {
  SHIPMENT_STATUSES,
  SHIPMENT_TYPES,
  type ShipmentStatus,
  type ShipmentType,
} from '@zclear/shared';

const reference = z.string().trim().min(1).max(100);
const clientName = z.string().trim().min(1).max(200);
const clientContact = z.string().trim().min(1).max(320);
const place = z.string().trim().min(1).max(200);
const consignment = z.record(z.unknown());
const note = z.string().trim().max(500);

export const createShipmentSchema = z
  .object({
    reference,
    clientName,
    clientContact: clientContact.optional(),
    type: z.enum(SHIPMENT_TYPES),
    origin: place.optional(),
    destination: place.optional(),
    consignment: consignment.optional(),
  })
  .strict();

export const updateShipmentSchema = z
  .object({
    reference,
    clientName,
    clientContact,
    type: z.enum(SHIPMENT_TYPES),
    origin: place,
    destination: place,
    consignment,
  })
  .partial()
  .strict();

/**
 * One-tap stage update. A hold must carry a reason; every other stage must not,
 * matching the shipments table's hold-reason check constraint.
 */
export const updateStageSchema = z
  .object({
    stage: z.enum(SHIPMENT_STATUSES),
    note: note.optional(),
    holdReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => value.stage !== 'on_hold' || Boolean(value.holdReason), {
    message: 'holdReason is required when the stage is on_hold',
    path: ['holdReason'],
  });

export const listShipmentsSchema = z
  .object({
    stage: z.enum(SHIPMENT_STATUSES).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type ListShipmentsQuery = z.infer<typeof listShipmentsSchema>;

export interface ShipmentSummary {
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
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentEventSummary {
  id: string;
  fromStage: ShipmentStatus | null;
  toStage: ShipmentStatus;
  note: string | null;
  source: string;
  actorUserId: string | null;
  createdAt: string;
}

export interface ShipmentDetail extends ShipmentSummary {
  events: ShipmentEventSummary[];
}
