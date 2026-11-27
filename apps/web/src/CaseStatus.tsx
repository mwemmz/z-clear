import { useEffect, useState } from 'react';
import { api, messageOf, type CaseStatus } from './api';

interface Props {
  token: string;
  caseId: string;
}

/**
 * Plain-language "My case" answers. Everything shown comes from the agency's
 * recorded stage, hold reason, checklist and invoices. The notice keeps the
 * ASYCUDA boundary explicit: Z Clear does not assess duty or decide release.
 */
export function CaseStatus({ token, caseId }: Props) {
  const [status, setStatus] = useState<CaseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus(null);
    setError(null);
    api
      .getCaseStatus(token, caseId)
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [token, caseId]);

  return (
    <section aria-labelledby="status-heading" className="card">
      <h2 id="status-heading">My case status</h2>
      {error && <p className="alert">{error}</p>}
      {!status && !error && <p className="hint">Loading status…</p>}
      {status && (
        <>
          <dl data-testid="case-status-answers" className="case-status">
            {status.answers.map((answer) => (
              <div key={answer.question} className="case-status__item">
                <dt>{answer.question}</dt>
                <dd>{answer.answer}</dd>
              </div>
            ))}
          </dl>
          <p className="hint" data-testid="case-status-notice">
            {status.notice}
          </p>
        </>
      )}
    </section>
  );
}
