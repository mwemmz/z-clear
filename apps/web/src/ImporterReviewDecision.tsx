import { useEffect, useState } from 'react';
import { IMPORTER_REVIEW_STATE_LABELS } from '@zclear/shared';
import { api, messageOf, type AgentReviewSummary } from './api';
import { ReviewScreen } from './screens';
import { Button, StatePanel, StatusPill } from './ui';

interface Props {
  token: string;
  caseId: string;
  onChanged: () => Promise<void>;
}

/** Live version of the review draft screen, backed by the existing review endpoints. */
export function ImporterReviewDecision({ token, caseId, onChanged }: Props) {
  const [review, setReview] = useState<AgentReviewSummary | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');
    setError(null);
    setConfirmation(null);
    void api
      .listReviews(token, caseId)
      .then((reviews) => {
        if (!active) return;
        const latest = reviews
          .slice()
          .sort((a, b) => b.revision - a.revision || b.updatedAt.localeCompare(a.updatedAt))[0];
        setReview(latest ?? null);
        setState('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(messageOf(cause));
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [token, caseId, attempt]);

  async function act(action: 'query' | 'approve'): Promise<void> {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'query') {
        const result = await api.queryReview(token, review.id, message.trim());
        setConfirmation(
          `Question recorded on revision ${result.revision}. Your agent can revise it.`,
        );
        setMessage('');
      } else {
        await api.approveReview(token, review.id);
        setConfirmation('Draft approved. The agency still records and files the handoff manually.');
      }
      await onChanged();
      const refreshed = await api.listReviews(token, caseId);
      setReview(
        refreshed
          .slice()
          .sort((a, b) => b.revision - a.revision || b.updatedAt.localeCompare(a.updatedAt))[0] ??
          null,
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') {
    return (
      <section className="card" data-testid="review-screen" aria-label="Review draft">
        <StatePanel variant="loading" title="Opening your review draft" />
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="card" data-testid="review-screen" aria-label="Review draft">
        <StatePanel
          variant="error"
          title="Could not open the review draft"
          message={error ?? undefined}
          action={
            <Button onClick={() => setAttempt((value) => value + 1)} variant="ghost">
              Try again
            </Button>
          }
        />
      </section>
    );
  }

  if (!review) {
    return (
      <section className="card" data-testid="review-screen" aria-label="Review draft">
        <StatePanel
          variant="empty"
          title="No draft to review"
          message="Your agent has not sent a draft for this sample case yet."
        />
      </section>
    );
  }

  if (review.state === 'approved') {
    return (
      <section className="card" data-testid="review-screen" aria-label="Review draft">
        <div className="current-case__header">
          <div>
            <span className="eyebrow">Draft check</span>
            <h2>Review complete</h2>
          </div>
          <StatusPill tone="success">{IMPORTER_REVIEW_STATE_LABELS.approved}</StatusPill>
        </div>
        <p>Revision {review.revision} was approved. The agency still handles the manual handoff.</p>
        {confirmation && <p className="confirmation">{confirmation}</p>}
        <p className="provenance">Nothing was filed or assessed by this app.</p>
      </section>
    );
  }

  if (review.state === 'queried') {
    return (
      <section className="card" data-testid="review-screen" aria-label="Review draft">
        <div className="current-case__header">
          <div>
            <span className="eyebrow">Draft check</span>
            <h2>Question sent</h2>
          </div>
          <StatusPill tone="warning">{IMPORTER_REVIEW_STATE_LABELS.queried}</StatusPill>
        </div>
        <p>{review.query ?? 'Your question is with the agency.'}</p>
        {confirmation && <p className="confirmation">{confirmation}</p>}
        <p className="hint">
          The agent can send a corrected revision. No action is needed from you.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="card" aria-labelledby="review-question-heading">
        <h2 id="review-question-heading">Ask about this draft</h2>
        <label htmlFor="review-question">Question for your agent</label>
        <textarea
          id="review-question"
          rows={2}
          maxLength={500}
          value={message}
          placeholder="What should be corrected?"
          onChange={(event) => setMessage(event.target.value)}
        />
        <p className="hint">
          Leave this blank to approve. A question keeps the draft open for correction.
        </p>
      </section>

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
      {confirmation && <p className="confirmation">{confirmation}</p>}

      <ReviewScreen
        revision={review.revision}
        field="Agent draft note"
        draftValue={review.message ?? 'No note recorded'}
        sourceValue="Your case record"
        message="Confirm that the draft matches what you gave your agent. This is an internal check, not a declaration."
        onQuery={() => void act('query')}
        onApprove={() => void act('approve')}
        queryDisabled={busy || message.trim().length === 0}
        approveDisabled={busy}
      />
    </>
  );
}
