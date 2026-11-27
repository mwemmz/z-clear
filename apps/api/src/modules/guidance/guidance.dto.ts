import { z } from 'zod';
import type { VerificationStatus } from '../../database/database.types';

/**
 * Agency-owned registry guidance. No steps are seeded: the UI shows an empty
 * state until the agency configures its own content. A row is guidance only
 * unless it has a current source and VERIFIED status.
 */
const stepKey = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9_]+$/, 'stepKey must be lower_snake_case');
const title = z.string().trim().min(1).max(120);
const detail = z.string().trim().max(1000);
const sortOrder = z.number().int().min(0).max(10_000);
const sourceUrl = z.string().trim().url().max(2000);
const effectiveDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be YYYY-MM-DD');
const verificationStatus = z.enum(['NEEDS_VERIFICATION', 'VERIFIED', 'SUPERSEDED']);

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

export const listGuidanceSchema = z
  .object({
    includeInactive: z.coerce.boolean().default(false),
  })
  .strict();

export const createGuidanceSchema = z
  .object({
    stepKey,
    title,
    detail: detail.optional(),
    sortOrder: sortOrder.default(0),
    sourceUrl: sourceUrl.optional(),
    effectiveDate: effectiveDate.optional(),
    verificationStatus: verificationStatus.default('NEEDS_VERIFICATION'),
  })
  .strict()
  .superRefine(verifiedNeedsSource);

export const updateGuidanceSchema = z
  .object({
    title: title.optional(),
    detail: detail.nullable().optional(),
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

export type ListGuidanceQuery = z.infer<typeof listGuidanceSchema>;
export type CreateGuidanceInput = z.infer<typeof createGuidanceSchema>;
export type UpdateGuidanceInput = z.infer<typeof updateGuidanceSchema>;

export interface GuidanceView {
  id: string;
  stepKey: string;
  title: string;
  detail: string | null;
  sortOrder: number;
  isActive: boolean;
  sourceUrl: string | null;
  effectiveDate: string | null;
  verificationStatus: VerificationStatus;
  /** True only for VERIFIED steps with a recorded source. */
  isVerified: boolean;
}
