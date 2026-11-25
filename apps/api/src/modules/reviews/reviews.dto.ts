import { z } from 'zod';
import {
  REVIEW_TRANSITIONS,
  type ImporterReviewAction,
  type ImporterReviewState,
} from '@zclear/shared';

const text = z.string().trim();
const note = text.min(1).max(500);

/**
 * Each review action has its own endpoint, so each has its own body schema:
 * `send` carries the agent's message, `query` the importer's question and
 * `revise` the corrected message for the new draft revision.
 */
export const sendReviewSchema = z.object({ message: note }).strict();
export const queryReviewSchema = z.object({ message: note }).strict();
export const reviseReviewSchema = z.object({ newMessage: note }).strict();

export const listReviewsSchema = z
  .object({
    shipmentId: z.string().uuid().optional(),
    state: z.enum(['draft', 'in_review', 'queried', 'approved']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type SendReviewInput = z.infer<typeof sendReviewSchema>;
export type QueryReviewInput = z.infer<typeof queryReviewSchema>;
export type ReviseReviewInput = z.infer<typeof reviseReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsSchema>;

export interface ReviewFindingSummary {
  code: string;
  field: string | null;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImporterReviewSummary {
  id: string;
  shipmentId: string;
  revision: number;
  parentReviewId: string | null;
  state: ImporterReviewState;
  message: string | null;
  query: string | null;
  wording: string | null;
  wordingSource: 'fixed' | 'ai';
  sentAt: string | null;
  queriedAt: string | null;
  approvedAt: string | null;
  /** True when the shipment changed after this revision was raised. */
  isStale: boolean;
  /** Actions legal on this revision right now (from the shared transitions). */
  allowedActions: ImporterReviewAction[];
  draftFindings: ReviewFindingSummary[];
  createdAt: string;
  updatedAt: string;
}

/** Actions the shared transition table permits per state (for docs/tests). */
export function allowedActionsForState(state: ImporterReviewState): ImporterReviewAction[] {
  return [...REVIEW_TRANSITIONS[state]];
}
