import { Gift, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { PointsSummary, ReferralsSummary } from '@zclear/shared';
import { api, messageOf } from './api';
import { Button, StatePanel } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  token: string;
  role: string;
  isSample: boolean;
}

/**
 * Right-side secondary panel. It exposes only verified programme structure;
 * balances stay 'Not available' until owner rules exist, and referrals carry no
 * reward or incentive claim.
 */
export function LoyaltyPanel({ open, onClose, token, role, isSample }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [referrals, setReferrals] = useState<ReferralsSummary | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    if (!open) return;
    let cancelled = false;

    if (role === 'driver') {
      setDenied(true);
      setLoading(false);
      setError(null);
      return () => {
        document.querySelector<HTMLButtonElement>('[data-testid="loyalty-open"]')?.focus();
      };
    }

    setLoading(true);
    setError(null);
    setDenied(false);
    void (async () => {
      try {
        const [pointsResult, referralsResult] = await Promise.all([
          api.pointsMe(token),
          api.referralsMe(token),
        ]);
        if (cancelled) return;
        setPoints(pointsResult);
        setReferrals(referralsResult);
      } catch (cause) {
        if (!cancelled) setError(messageOf(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      document.querySelector<HTMLButtonElement>('[data-testid="loyalty-open"]')?.focus();
    };
  }, [open, token, role]);

  function requestClose(): void {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    onClose();
  }

  const pointsConfigured = points ? points.program.version > 0 : false;
  const referralsConfigured = referrals ? referrals.program.version > 0 : false;

  return (
    <dialog
      ref={dialogRef}
      className="loyalty-panel"
      data-testid="loyalty-panel"
      aria-labelledby="loyalty-panel-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <header className="loyalty-panel__header">
        <div>
          <span className="eyebrow">Side panel</span>
          <h2 id="loyalty-panel-title">
            <Gift size={20} aria-hidden="true" /> Points & referrals
          </h2>
        </div>
        <Button variant="icon" iconOnly aria-label="Close programme panel" onClick={requestClose}>
          <X size={20} aria-hidden="true" />
        </Button>
      </header>

      <div className="loyalty-panel__body">
        {isSample && (
          <p className="provenance" data-testid="loyalty-sample-label">
            Sample data · no network request · no verified rules
          </p>
        )}

        {denied && (
          <StatePanel
            variant="denied"
            title="Not available for this role"
            message="Drivers record manual check-ins only. No points or referral panel is available."
          />
        )}

        {loading && (
          <StatePanel
            variant="loading"
            title="Checking programme rules"
            message="Only saved, verified configuration can appear here."
          />
        )}

        {error && !denied && (
          <StatePanel
            variant="error"
            title="Could not load programme"
            message={`${error}. Nothing was changed.`}
          />
        )}

        {!loading && !denied && !error && points && referrals && (
          <>
            <section className="loyalty-card" aria-labelledby="loyalty-points-heading">
              <div className="loyalty-card__heading">
                <span className="badge">Points</span>
                <h3 id="loyalty-points-heading">Points programme</h3>
              </div>
              <dl className="loyalty-facts">
                <div>
                  <dt>Rules</dt>
                  <dd>
                    {pointsConfigured ? `Version ${points.program.version}` : 'Not configured'}
                  </dd>
                </div>
                <div>
                  <dt>Balance</dt>
                  <dd data-testid="points-balance">
                    {points.balance === null ? 'Not available' : points.balance}
                  </dd>
                </div>
              </dl>
              <p className="hint" data-testid="points-notice">
                {points.program.notice}
              </p>
              {points.ledger.length === 0 ? (
                <p className="empty">No ledger entries are recorded.</p>
              ) : (
                <ol className="loyalty-list">
                  {points.ledger.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.reasonCode}</span>
                      <span>{entry.points}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="loyalty-card" aria-labelledby="loyalty-referrals-heading">
              <div className="loyalty-card__heading">
                <span className="badge">Referrals</span>
                <h3 id="loyalty-referrals-heading">Referral programme</h3>
              </div>
              <dl className="loyalty-facts">
                <div>
                  <dt>Rules</dt>
                  <dd>
                    {referralsConfigured
                      ? `Version ${referrals.program.version}`
                      : 'Not configured'}
                  </dd>
                </div>
                <div>
                  <dt>Records</dt>
                  <dd data-testid="referral-records">{referrals.records.length}</dd>
                </div>
              </dl>
              <p className="hint" data-testid="referrals-notice">
                {referrals.program.notice}
              </p>
              <p className="provenance">
                Records are structural only. No reward, incentive or referral claim is encoded.
              </p>
            </section>
          </>
        )}
      </div>
    </dialog>
  );
}
