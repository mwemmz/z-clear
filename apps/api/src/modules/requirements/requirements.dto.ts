import { z } from 'zod';
import type { CaseKind, VerificationStatus } from '../../database/database.types';

/**
 * Agencies configure their own checklist. No ZRA document list is seeded: the
 * rows are tenant config, not authority data. Rules are guidance only until a
 * current ZRA source is recorded and the status is changed to VERIFIED.
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
const sourceUrl = z.string().trim().url().max(2000);
const effectiveDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be YYYY-MM-DD');
const verificationStatus = z.enum(['NEEDS_VERIFICATION', 'VERIFIED']);

/** VERIFIED is only meaningful when the evidence is recorded. */
function verifiedNeedsSource(
  value: { verificationStatus?: string; sourceUrl?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.verificationStatus === 'VERIFIED' && !value.sourceUrl) {
    ctx.addIssue({
      code: 'custom',
      path: ['verificationStatus'],
      message: 'VERIFIED requires a sourceUrl',
    });
  }
}

export const listRequirementsSchema = z
  .object({
    shipmentType: z.enum(REQUIREMENT_SHIPMENT_TYPES).optional(),
    caseKind: z.enum(['vehicle', 'goods']).optional(),
  })
  .strict();

export const createRequirementSchema = z
  .object({
    shipmentType: z.enum(REQUIREMENT_SHIPMENT_TYPES),
    /** Omit to apply the rule to every case kind. */
    caseKind: z.enum(['vehicle', 'goods']).optional(),
    docType,
    label,
    isMandatory: z.boolean().default(true),
    sortOrder: sortOrder.default(0),
    sourceUrl: sourceUrl.optional(),
    effectiveDate: effectiveDate.optional(),
    verificationStatus: verificationStatus.default('NEEDS_VERIFICATION'),
  })
  .strict()
  .superRefine(verifiedNeedsSource);

export const updateRequirementSchema = z
  .object({
    label: label.optional(),
    isMandatory: z.boolean().optional(),
    sortOrder: sortOrder.optional(),
    isActive: z.boolean().optional(),
    sourceUrl: sourceUrl.nullable().optional(),
    effectiveDate: effectiveDate.nullable().optional(),
    verificationStatus: verificationStatus.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field must be provided',
  })
  .superRefine(verifiedNeedsSource);

export type ListRequirementsQuery = z.infer<typeof listRequirementsSchema>;
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export interface RequirementView {
  id: string;
  shipmentType: RequirementShipmentType;
  caseKind: CaseKind | null;
  docType: string;
  label: string;
  isMandatory: boolean;
  sortOrder: number;
  isActive: boolean;
  sourceUrl: string | null;
  effectiveDate: string | null;
  verificationStatus: VerificationStatus;
}
