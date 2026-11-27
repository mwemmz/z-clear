import { useEffect, useState, type FormEvent } from 'react';
import { api, messageOf, type CaseValuation } from './api';

interface Props {
  token: string;
  caseId: string;
}

/**
 * Shows the value the importer recorded on their own case and lets them send a
 * question to their agent through the existing review-query endpoint. It never
 * calculates duty, VAT or a customs value, and never claims ZRA has decided
 * anything.
 */
export function ValuationQuery({ token, caseId }: Props) {
  const [info, setInfo] = useState<CaseValuation | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setInfo(null);
    setError(null);
    setConfirmation(null);
    api
      .getCaseValuation(token, caseId)
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [token, caseId]);

  const canQuery = Boolean(info?.review?.allowedActions.includes('query'));

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const review = info?.review;
    if (!review || !canQuery || busy) return;
    setBusy(true);
    setError(null);
    setConfirmation(null);
    try {
      await api.queryReview(token, review.id, message);
      setMessage('');
      setConfirmation(
        'Your question has been recorded. Your agent can see it in the review queue.',
      );
      setInfo(await api.getCaseValuation(token, caseId));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="valuation-heading" className="card">
      <h2 id="valuation-heading">Value on your case</h2>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {!info && !error && <p className="hint">Loading recorded value…</p>}
      {info && (
        <>
          {info.recorded ? (
            <dl data-testid="recorded-valuation" className="valuation">
              <dt>{info.recorded.label}</dt>
              <dd data-testid="valuation-amount">{info.recorded.formatted}</dd>
              <dt>Description</dt>
              <dd>{info.recorded.description}</dd>
            </dl>
          ) : (
            <p className="empty" data-testid="valuation-missing">
              No structured value was recorded for this case. Ask your agency directly.
            </p>
          )}
          <p className="hint" data-testid="valuation-notice">
            {info.notice}
          </p>

          {info.review?.query && (
            <p className="hint" data-testid="recorded-question">
              Your question: {info.review.query}
            </p>
          )}
          {!info.review && (
            <p className="hint" data-testid="valuation-no-review">
              No review has been sent for this case yet. You can still see the value recorded on it.
            </p>
          )}
          {info.review && !canQuery && info.review.state !== 'queried' && (
            <p className="hint" data-testid="valuation-query-closed">
              This revision is not open for questions. Your agency must raise a new revision first.
            </p>
          )}

          {canQuery && (
            <form className="valuation-form" onSubmit={(event) => void handleSubmit(event)}>
              <label htmlFor="valuation-question">
                If this is not what you meant, tell your agent what to check
              </label>
              <textarea
                id="valuation-question"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                minLength={10}
                maxLength={500}
                required
                rows={3}
              />
              <button type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send question to my agent'}
              </button>
            </form>
          )}
          {confirmation && (
            <p className="hint" data-testid="valuation-confirmation">
              {confirmation}
            </p>
          )}
        </>
      )}
    </section>
  );
}
