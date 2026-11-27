import { useEffect, useState } from 'react';
import type { PersonalisedChecklist } from '@zclear/shared';
import { api, messageOf } from './api';

interface Props {
  token: string;
  caseId: string;
}

/**
 * Read-only, provenance-labelled checklist for the importer's own case.
 * Unverified agency guidance is visibly separated from VERIFIED rules and is
 * never presented as an official ZRA requirement.
 */
export function Checklist({ token, caseId }: Props) {
  const [checklist, setChecklist] = useState<PersonalisedChecklist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setChecklist(null);
    setError(null);
    api
      .getChecklist(token, caseId)
      .then((value) => {
        if (active) setChecklist(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [token, caseId]);

  return (
    <section aria-labelledby="checklist-heading" className="card">
      <h2 id="checklist-heading">Your document checklist</h2>
      {error && <p className="alert">{error}</p>}
      {!checklist && !error && <p className="hint">Loading checklist…</p>}
      {checklist && (
        <>
          <p className="hint" data-testid="checklist-notice">
            {checklist.notice}
          </p>
          {checklist.hasUnverifiedRules && (
            <p className="hold" data-testid="checklist-unverified-banner">
              Unverified guidance — not an official ZRA requirement.
            </p>
          )}
          {checklist.rules.length === 0 ? (
            <p className="empty">No checklist items have been configured for this case yet.</p>
          ) : (
            <ul className="checklist">
              {checklist.rules.map((rule) => (
                <li key={rule.docType} data-testid={`checklist-${rule.docType}`}>
                  <span className="checklist__status" aria-hidden="true">
                    {rule.satisfied ? '✓' : '○'}
                  </span>
                  <span className="checklist__label">{rule.label}</span>
                  {rule.verificationStatus !== 'VERIFIED' ? (
                    <span className="badge badge--warn">Unverified</span>
                  ) : (
                    <span className="badge badge--ok">Verified source</span>
                  )}
                  {rule.sourceUrl && (
                    <a href={rule.sourceUrl} rel="noreferrer noopener" target="_blank">
                      Source
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {checklist.missingMandatory.length > 0 && (
            <p className="hint" data-testid="checklist-missing">
              Still needed: {checklist.missingMandatory.length} item(s)
            </p>
          )}
        </>
      )}
    </section>
  );
}
