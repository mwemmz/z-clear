/**
 * Importer review domain: the agent sends a shipment's details to the importer
 * (a `client_viewer` user), the importer can query it, corrections produce a
 * new revision, and the agent approves. Customs filing itself stays manual in
 * ASYCUDA World — a review here is an internal checklist workflow, not a
 * declaration.
 */

/** Lifecycle states of one review revision. */
export const IMPORTER_REVIEW_STATES = ['draft', 'in_review', 'queried', 'approved'] as const;
export type ImporterReviewState = (typeof IMPORTER_REVIEW_STATES)[number];

/** Actions a caller can request on the current revision. */
export const IMPORTER_REVIEW_ACTIONS = ['send', 'query', 'revise', 'approve'] as const;
export type ImporterReviewAction = (typeof IMPORTER_REVIEW_ACTIONS)[number];

export const IMPORTER_REVIEW_STATE_LABELS: Record<ImporterReviewState, string> = {
  draft: 'Draft',
  in_review: 'In review',
  queried: 'Queried',
  approved: 'Approved',
};

/**
 * Allowed transitions for the current revision. `revise` is special: it ends
 * this revision's lifecycle and opens a fresh draft revision.
 */
export const REVIEW_TRANSITIONS: Record<ImporterReviewState, readonly ImporterReviewAction[]> = {
  draft: ['send'],
  in_review: ['query', 'revise', 'approve'],
  queried: ['revise'],
  approved: [],
};

export function isReviewTransition(state: ImporterReviewState, action: ImporterReviewAction): boolean {
  return REVIEW_TRANSITIONS[state].includes(action);
}

/**
 * Deterministic pre-send draft check. Pure function: the same input always
 * yields the same findings, so it can run per revision without a model and its
 * output can be stored on the review row. This is a completeness check on data
 * the agent keyed in — never a duty, VAT or fee computation.
 */
export interface DraftCheckInput {
  reference: string;
  clientName: string;
  clientContact: string | null;
  type: string;
  origin: string | null;
  destination: string | null;
  consignment: Record<string, unknown>;
  /** TPIN stored on the assigned importer user, if any (synthetic in demo data). */
  importerTpin: string | null;
}

export interface DraftFinding {
  /** Stable machine code, e.g. `missing_contact`, `tpin_mismatch`. */
  code: string;
  field: string | null;
  message: string;
  severity: 'error' | 'warning';
}

function finding(
  code: string,
  field: string | null,
  message: string,
  severity: DraftFinding['severity'],
): DraftFinding {
  return { code, field, message, severity };
}

export function checkDraft(input: DraftCheckInput): DraftFinding[] {
  const findings: DraftFinding[] = [];

  if (!input.clientContact || input.clientContact.trim().length === 0) {
    findings.push(
      finding('missing_contact', 'clientContact', 'Importer contact details are missing.', 'error'),
    );
  }
  if (!input.origin || input.origin.trim().length === 0) {
    findings.push(finding('missing_origin', 'origin', 'Origin is not recorded.', 'warning'));
  }
  if (!input.destination || input.destination.trim().length === 0) {
    findings.push(
      finding('missing_destination', 'destination', 'Destination is not recorded.', 'warning'),
    );
  }

  const consignmentTpin =
    typeof input.consignment.tpin === 'string' ? input.consignment.tpin.trim() : '';
  if (consignmentTpin) {
    // Loose shape check on the keyed TPIN: digits only. The authoritative TPIN
    // is whatever the importer user carries; a mismatch is flagged, never
    // assumed to be either party's fault.
    if (!/^\d+$/.test(consignmentTpin)) {
      findings.push(
        finding('tpin_format', 'consignment.tpin', 'TPIN should contain digits only.', 'warning'),
      );
    } else if (input.importerTpin && consignmentTpin !== input.importerTpin) {
      findings.push(
        finding(
          'tpin_mismatch',
          'consignment.tpin',
          'TPIN on the shipment does not match the importer record.',
          'warning',
        ),
      );
    }
  }

  return findings;
}

export function hasBlockingFinding(findings: readonly DraftFinding[]): boolean {
  return findings.some((item) => item.severity === 'error');
}

/**
 * Internal workflow points for completing review steps. These are engagement
 * scores for the agency's own process — not customs duties, taxes or fees —
 * and the defaults are configuration-style constants, easy to change without
 * touching the ledger.
 */
export const REVIEW_POINT_EVENTS = {
  review_sent: 10,
  review_approved: 25,
} as const;

export type ReviewPointEvent = keyof typeof REVIEW_POINT_EVENTS;

export const REVIEW_POINT_EVENT_CODES = Object.keys(REVIEW_POINT_EVENTS) as ReviewPointEvent[];
