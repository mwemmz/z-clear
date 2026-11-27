import { z } from 'zod';

/**
 * Agencies configure their own checklist. No ZRA document list is seeded: the
 * rows are tenant config, not authority data.
 */
export const REQUIREMENT_SHIPMENT_TYPES = ['import', 'export', 'transit'] as const;
export type RequirementShipmentType = (typeof REQUIREMENT_SHIPMENT_TYPES)[number];

const docType = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9_]+$/, 'docType must be lower_snake_case');
const label = z.string().trim().min(1).max(120);
const sortOrder = z.number().int().min(0).max(10_000);

export const listRequirementsSchema = z
  .object({ shipmentType: z.enum(REQUIREMENT_SHIPMENT_TYPES).optional() })
  .strict();

export const createRequirementSchema = z
  .object({
    shipmentType: z.enum(REQUIREMENT_SHIPMENT_TYPES),
    docType,
    label,
    isMandatory: z.boolean().default(true),
    sortOrder: sortOrder.default(0),
  })
  .strict();

export const updateRequirementSchema = z
  .object({
    label: label.optional(),
    isMandatory: z.boolean().optional(),
    sortOrder: sortOrder.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field must be provided',
  });

export type ListRequirementsQuery = z.infer<typeof listRequirementsSchema>;
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export interface RequirementView {
  id: string;
  shipmentType: RequirementShipmentType;
  docType: string;
  label: string;
  isMandatory: boolean;
  sortOrder: number;
  isActive: boolean;
}
