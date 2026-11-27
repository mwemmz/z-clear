import { useEffect, useState } from 'react';
import { api, messageOf, type RegistryGuidanceView } from './api';

/**
 * Real registry guidance from the agency's own configuration. No steps are
 * seeded by the platform, and unverified rows are labelled as guidance only.
 * Nothing here submits anything to ZRA or ASYCUDA World.
 */
export function RegistryGuidance({ token }: { token: string }) {
  const [items, setItems] = useState<RegistryGuidanceView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.listGuidance(token);
        if (!cancelled) {
          setItems(result);
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

  return (
    <section className="card workflow" aria-labelledby="guidance-heading">
      <h2 id="guidance-heading">Registry guidance</h2>
      <p className="hint" data-testid="guidance-notice">
        Configured by this agency, not filed with ZRA. Steps without a current source are guidance
        only — confirm current requirements with ZRA before acting. No official list is seeded.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {busy && <p className="empty">Loading guidance…</p>}
      {!busy && !error && items.length === 0 && (
        <p className="empty">This agency has not configured any guidance steps yet.</p>
      )}
      {items.length > 0 && (
        <ol className="guidance-list">
          {items.map((item) => (
            <li className="guidance-list__item" key={item.id} data-testid="guidance-row">
              <strong>{item.title}</strong>
              <span
                className={`badge ${item.isVerified ? 'badge--ok' : 'badge--warn'}`}
                data-testid="guidance-verification"
              >
                {item.isVerified ? 'Verified with source' : 'Needs verification'}
              </span>
              {item.detail && <span className="guidance-list__sub">{item.detail}</span>}
              <span className="guidance-list__meta">
                {item.effectiveDate
                  ? `Effective ${item.effectiveDate}`
                  : 'No effective date recorded'}
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
