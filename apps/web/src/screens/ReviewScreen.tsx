import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { Button, StatePanel, StatusPill, type StateVariant } from '../ui';

interface Props {
  revision: number;
  field: string;
  draftValue: string;
  sourceValue: string;
  message: string;
  stale?: boolean;
  state?: StateVariant;
  onQuery: () => void;
  onApprove: () => void;
  queryDisabled?: boolean;
  approveDisabled?: boolean;
}

/** Importer review: draft versus source in plain language, then two clear actions. */
export function ReviewScreen({
  revision,
  field,
  draftValue,
  sourceValue,
  message,
  stale = false,
  state,
  onQuery,
  onApprove,
  queryDisabled = false,
  approveDisabled = false,
}: Props) {
  if (state) {
    return (
      <section className="card" data-testid="review-screen" aria-labelledby="review-heading">
        <h2 className="sr-only" id="review-heading">
          Review draft
        </h2>
        <StatePanel variant={state} />
      </section>
    );
  }

  return (
    <section className="card" data-testid="review-screen" aria-labelledby="review-heading">
      <div className="current-case__header">
        <div>
          <span className="eyebrow">Draft comparison</span>
          <h2 id="review-heading">Review draft</h2>
          <p className="recent-cases__meta">Revision {revision}</p>
        </div>
        <StatusPill tone={stale ? 'warning' : 'info'}>
          {stale ? 'Newer draft available' : 'Draft check'}
        </StatusPill>
      </div>

      {stale && <StatePanel variant="stale" />}

      <div className="sheet__section draft-check">
        <strong>{field}</strong>
        <div className="draft-check__values">
          <div className="draft-check__value">
            <span>Draft value</span>
            <strong>{draftValue}</strong>
          </div>
          <div className="draft-check__value">
            <span>Source value</span>
            <strong>{sourceValue}</strong>
          </div>
        </div>
        <p>{message}</p>
        <p className="provenance">
          Values shown for review only. No filing or assessment happens here.
        </p>
      </div>

      <div className="review-actions">
        <Button onClick={onQuery} disabled={stale || queryDisabled} aria-label="Query this draft">
          <WarningCircle size={20} aria-hidden="true" /> Query
        </Button>
        <Button
          variant="primary"
          onClick={onApprove}
          disabled={stale || approveDisabled}
          aria-label="Approve this draft"
        >
          <CheckCircle size={20} aria-hidden="true" /> Approve
        </Button>
      </div>
    </section>
  );
}
