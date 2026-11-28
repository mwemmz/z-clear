import { useEffect, useState } from 'react';
import type { ImporterReviewState } from '@zclear/shared';
import { api, messageOf, type AgentReviewSummary, type ShipmentSummary } from './api';
import { Button, StatePanel } from './ui';

const STATE_LABELS: Record<ImporterReviewState, string> = {
  draft: 'Draft',
  in_review: 'In review',
  queried: 'Queried',
  approved: 'Approved',
};

function nextAction(review: AgentReviewSummary): string {
  if (review.isStale) return 'Material edit after approval — review again';
  if (review.state === 'queried') return 'Answer importer query';
  if (review.state === 'in_review') return 'Waiting for importer';
  if (review.state === 'draft') return 'Finish and send';
  return 'Complete — keyed manually in ASYCUDA';
}

interface AgentReviewsProps {
  token: string;
  shipments: ShipmentSummary[];
  onChanged?: () => Promise<void>;
}

interface ReviewRowProps {
  review: AgentReviewSummary;
  reference: string;
  clientName: string;
  token: string;
  onChanged: () => Promise<void>;
}

function ReviewRow({ review, reference, clientName, token, onChanged }: ReviewRowProps) {
  const [message, setMessage] = useState(review.message ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'send' | 'revise'): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (action === 'send') {
        await api.sendReview(token, review.shipmentId, message.trim());
      } else {
        await api.reviseReview(token, review.id, message.trim());
      }
      await onChanged();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="review-list__item">
      <div>
        <strong>{reference}</strong>
        <span className="review-list__sub">
          {clientName} · rev {review.revision}
        </span>
      </div>
      <div className="review-list__meta">
        <span className={`badge ${review.state === 'approved' ? 'badge--ok' : 'badge--warn'}`}>
          {STATE_LABELS[review.state]}
        </span>
        <span>{nextAction(review)}</span>
      </div>
      {review.query && <p className="review-list__note">Query: {review.query}</p>}
      {review.allowedActions.includes('send') && (
        <div className="review-list__action">
          <label htmlFor={`review-message-${review.id}`}>Message to importer</label>
          <textarea
            id={`review-message-${review.id}`}
            rows={2}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button
            loading={busy}
            disabled={message.trim().length === 0}
            onClick={() => void run('send')}
          >
            Send draft
          </Button>
        </div>
      )}
      {review.allowedActions.includes('revise') && (
        <div className="review-list__action">
          <label htmlFor={`review-revision-${review.id}`}>Corrected note</label>
          <textarea
            id={`review-revision-${review.id}`}
            rows={2}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button
            loading={busy}
            disabled={message.trim().length === 0}
            onClick={() => void run('revise')}
          >
            Send revision
          </Button>
        </div>
      )}
      {error && <StatePanel variant="error" message={error} />}
    </li>
  );
}

/** Real staff inbox backed by GET /reviews; no sample ratings or mock cases. */
export function AgentReviews({ token, shipments, onChanged }: AgentReviewsProps) {
  const [reviews, setReviews] = useState<AgentReviewSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function reload(): Promise<void> {
    const result = await api.listReviews(token);
    setReviews(result);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.listReviews(token);
        if (!cancelled) {
          setReviews(result);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(messageOf(cause));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const byId = new Map(shipments.map((shipment) => [shipment.id, shipment]));

  return (
    <section className="card workflow" aria-labelledby="review-inbox-heading">
      <h2 id="review-inbox-heading">Review inbox</h2>
      <p className="hint">
        Live GET /reviews data for this tenant. Approval always binds to the exact revision shown.
      </p>
      {error && (
        <StatePanel
          variant="error"
          message={error}
          action={
            <Button variant="ghost" onClick={() => setError(null)}>
              Dismiss
            </Button>
          }
        />
      )}
      {busy && <StatePanel variant="loading" title="Loading reviews" />}
      {!busy && !error && reviews.length === 0 && (
        <StatePanel variant="empty" title="No reviews have been sent yet" />
      )}
      {reviews.length > 0 && (
        <ul className="review-list">
          {reviews.map((review) => {
            const shipment = byId.get(review.shipmentId);
            return (
              <ReviewRow
                key={review.id}
                review={review}
                token={token}
                reference={shipment?.reference ?? review.shipmentId.slice(0, 8)}
                clientName={shipment?.clientName ?? 'Case not in this list'}
                onChanged={async () => {
                  await reload();
                  await onChanged?.();
                }}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
