import { z } from 'zod';
import { caseConsignmentSchema } from '@zclear/shared';
import type { CaseStatusAnswer, PersonalisedChecklist } from '@zclear/shared';
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
