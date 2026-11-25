import { z } from 'zod';
import {
  IMPORTER_REVIEW_ACTIONS,
  type DraftFinding,
  type ImporterReviewAction,
  type ImporterReviewState,
} from '@zclear/shared';

const text = z.string().trim();
const note = text.min(1).max(500);

/**
 * Only the actions a caller can request; the current revision state decides
 * which are legal (shared REVIEW_TRANSITIONS), so callers cannot teleport a
 * review from draft to approved.
 */
export const reviewActionSchema = z
  .object({
    action: z.enum(IMPORTER_REVIEW_ACTIONS),
    /** Message from the agent (used by send) or the importer (by query). */
    message: note.optional(),
    /** Required for `revise`: replacement message for the new draft revision. */
    newMessage: note.optional(),
  })
  .strict()
  .refine((value) => value.action !== 'send' || Boolean(value.message), {
    message: 'message is required when sending a review',
    path: ['message'],
  })
  .refine((value) => value.action !== 'revise' || Boolean(value.newMessage), {
    message: 'newMessage is required when revising a review',
    path: ['newMessage'],
  });

export const listReviewsSchema = z
  .object({
    shipmentId: z.string().uuid().optional(),
    state: z.enum(['draft', 'in_review', 'queried', 'approved']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ReviewActionInput = z.infer<typeof reviewActionSchema>;
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
  isStale: boolean;
  /** Actions legal on this revision right now (from the shared transitions). */
  allowedActions: ImporterReviewAction[];
  draftFindings: ReviewFindingSummary[];
  createdAt: string;
  updatedAt: string;
}

export type DraftFindingLike = DraftFinding;
