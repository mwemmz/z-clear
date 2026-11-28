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
  onClearPoints: () => void;
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
  onClearPoints,
}: Props) {
  if (state) {
    return (
      <section className="card" data-testid="review-screen" aria-labelledby="review-heading">
        <StatePanel variant={state} />
      </section>
    );
  }

  return (
    <section className="card" data-testid="review-screen" aria-labelledby="review-heading">
      <div className="current-case__header">
        <div>
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
      </div>

      <div className="review-actions">
        <Button onClick={onQuery} disabled={stale} aria-label="Query this draft">
          <WarningCircle size={20} aria-hidden="true" /> Query
        </Button>
        <Button
          variant="primary"
          onClick={onApprove}
          disabled={stale}
          aria-label="Approve this draft"
        >
          <CheckCircle size={20} aria-hidden="true" /> Approve
        </Button>
        <Button variant="ghost" onClick={onClearPoints}>
          Clear Points
        </Button>
      </div>
    </section>
  );
}
