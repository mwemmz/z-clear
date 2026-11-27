import { z } from 'zod';
import { caseConsignmentSchema } from '@zclear/shared';
import type {
  CaseStatusAnswer,
  ImporterReviewAction,
  ImporterReviewState,
  PersonalisedChecklist,
  RecordedValuation,
} from '@zclear/shared';
import type { ShipmentSummary } from '../shipments/shipments.dto';

/**
 * An importer opens their own case before an agent is appointed. The caller
 * cannot choose the importer, the agent or a reference: all three are derived
 * server-side so a client cannot attach a case to someone else's account.
 */
export const createCaseSchema = z
  .object({
    clientName: z.string().trim().min(1).max(200),
    clientContact: z.string().trim().min(1).max(320),
    consignment: caseConsignmentSchema,
  })
  .strict();

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type CaseSummary = ShipmentSummary;
export type CaseChecklist = PersonalisedChecklist;

/** Plain-language answers derived only from this tenant's recorded case data. */
export interface CaseStatus {
  caseId: string;
  answers: CaseStatusAnswer[];
  notice: string;
}

/**
 * Information shown when an importer disagrees with a recorded value. The
 * query itself uses the existing review endpoint; this payload only exposes
 * the recorded value, boundary notice and whether a query is currently legal.
 */
export interface CaseValuation {
  caseId: string;
  recorded: RecordedValuation | null;
  notice: string;
  review: {
    id: string;
    revision: number;
    state: ImporterReviewState;
    query: string | null;
    allowedActions: ImporterReviewAction[];
  } | null;
}
