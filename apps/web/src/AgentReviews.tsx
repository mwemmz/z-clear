import { useEffect, useState } from 'react';
import type { ImporterReviewState } from '@zclear/shared';
import { api, messageOf, type AgentReviewSummary, type ShipmentSummary } from './api';

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
}

/** Real staff inbox backed by GET /reviews; no sample ratings or mock cases. */
export function AgentReviews({ token, shipments }: AgentReviewsProps) {
  const [reviews, setReviews] = useState<AgentReviewSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

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
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {busy && <p className="empty">Loading reviews…</p>}
      {!busy && !error && reviews.length === 0 && (
        <p className="empty">No reviews have been sent yet.</p>
      )}
      {reviews.length > 0 && (
        <ul className="review-list">
          {reviews.map((review) => {
            const shipment = byId.get(review.shipmentId);
            return (
              <li className="review-list__item" key={review.id}>
                <div>
                  <strong>{shipment?.reference ?? review.shipmentId.slice(0, 8)}</strong>
                  <span className="review-list__sub">
                    {shipment?.clientName ?? 'Case not in this list'} · rev {review.revision}
                  </span>
                </div>
                <div className="review-list__meta">
                  <span
                    className={`badge ${review.state === 'approved' ? 'badge--ok' : 'badge--warn'}`}
                  >
                    {STATE_LABELS[review.state]}
                  </span>
                  <span>{nextAction(review)}</span>
                </div>
                {review.query && <p className="review-list__note">Query: {review.query}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
