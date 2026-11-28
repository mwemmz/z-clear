import type {
  PointLedgerEntry,
  PointsSummary,
  ReferralRecord,
  ReferralsSummary,
} from '@zclear/shared';
import { z } from 'zod';

/**
 * Loyalty read models are re-exported from the shared domain package: the web
 * panel and the API must use the same no-invented-values contract.
 */
export type { PointLedgerEntry, PointsSummary, ReferralRecord, ReferralsSummary };

export const listPointLedgerSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListPointLedgerQuery = z.infer<typeof listPointLedgerSchema>;
