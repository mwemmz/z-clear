import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SHIPMENT_STATUS_LABELS } from '@zclear/shared';
import { AgentDirectory } from './AgentDirectory';
import { CaseForm } from './CaseForm';
import { CaseStatus } from './CaseStatus';
import { Checklist } from './Checklist';
import { Mockups } from './mockups';
import { ComplianceAssistant } from './ComplianceAssistant';
import { ValuationQuery } from './ValuationQuery';
import {
  api,
  messageOf,
  type AppointmentResult,
  type ShipmentDetail,
  type ShipmentSummary,
  type UserProfile,
} from './api';

const TOKEN_KEY = 'zclear_demo_token';

const ROLE_LABELS: Record<string, string> = {
  agency_owner: 'Agency owner',
  agent_staff: 'Clearing agent',
  client_viewer: 'Importer / client',
  platform_admin: 'Platform admin',
};

function display(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function goodsSummary(consignment: Record<string, unknown>): string {
  const entries = Object.entries(consignment);
  if (entries.length === 0) {
    return 'No goods summary recorded';
  }
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${display(value)}`)
    .join('; ');
}

export function App() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMockups, setShowMockups] = useState(false);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [appointmentNotice, setAppointmentNotice] = useState<string | null>(null);
  // A slow initial shipment load must not erase a case the importer has just
  // created while that request was in flight.
  const createdCaseRef = useRef(false);

  const firstId = shipments[0]?.id ?? null;

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        const [profile, list] = await Promise.all([api.me(token), api.listShipments(token)]);
        if (cancelled) return;
        setUser(profile);
        if (!createdCaseRef.current) {
          setShipments(list);
          setSelectedId(null);
        }
        setError(null);
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

  useEffect(() => {
    if (!selectedId && firstId) {
      setSelectedId(firstId);
    }
  }, [firstId, selectedId]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.getShipment(token, selectedId);
        if (!cancelled) {
          setDetail(result);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(messageOf(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    setBusy(true);
    setError(null);
    createdCaseRef.current = false;
    try {
      const result = await api.login(email, password);
      sessionStorage.setItem(TOKEN_KEY, result.accessToken);
      setToken(result.accessToken);
      setUser(result.user);
      setAppointmentNotice(null);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  function handleCaseCreated(shipment: ShipmentSummary): void {
    createdCaseRef.current = true;
    setShipments((current) => [shipment, ...current]);
    setSelectedId(shipment.id);
    setShowCaseForm(false);
    setError(null);
  }

  function handleSignOut(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    createdCaseRef.current = false;
    setToken('');
    setUser(null);
    setShipments([]);
    setSelectedId(null);
    setDetail(null);
    setError(null);
  }

  function handleAppointed(_result: AppointmentResult): void {
    // The access token still carries the importer's old tenant claim. Signing
    // out forces a fresh login so the case is visible in the agency tenant.
    handleSignOut();
    setAppointmentNotice('Agent appointed. Sign in again to continue in the agency workspace.');
  }

  return (
    <main className="shell">
      <header className="shell__header">
        <div className="shell__titlerow">
          <h1>Z Clear</h1>
          {user && (
            <span className="role-badge" data-testid="role-badge">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          )}
        </div>
        <p className="shell__subtitle">Shipment workspace</p>
        {user && (
          <button type="button" className="link-button" onClick={handleSignOut}>
            Sign out
          </button>
        )}
      </header>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {appointmentNotice && (
        <p className="hint" data-testid="appointment-notice">
          {appointmentNotice}
        </p>
      )}

      {!token && (
        <section aria-labelledby="signin-heading" className="card">
          <h2 id="signin-heading">Sign in</h2>
          <form className="login" onSubmit={(event) => void handleLogin(event)}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="hint">
            Demo sign-in uses credentials issued by your agency. No credentials are hardcoded in the
            app.
          </p>
        </section>
      )}

      {token && busy && <p className="hint">Loading case file…</p>}

      {token && user?.role === 'client_viewer' && (
        <section aria-labelledby="new-case-toggle" className="card">
          <button
            id="new-case-toggle"
            type="button"
            onClick={() => setShowCaseForm((value) => !value)}
          >
            {showCaseForm ? 'Cancel' : 'Open a new case'}
          </button>
          {showCaseForm && <CaseForm token={token} onCreated={handleCaseCreated} />}
        </section>
      )}

      {token && user && shipments.length === 0 && !busy && (
        <p className="empty">No shipments are available for this account yet.</p>
      )}

      {token && user && shipments.length > 0 && (
        <>
          {shipments.length > 1 && (
            <nav aria-label="Choose a shipment" className="switcher">
              {shipments.map((shipment) => (
                <button
                  key={shipment.id}
                  type="button"
                  className={
                    shipment.id === selectedId ? 'switcher__item is-active' : 'switcher__item'
                  }
                  aria-current={shipment.id === selectedId ? 'true' : undefined}
                  onClick={() => setSelectedId(shipment.id)}
                >
                  {shipment.reference}
                </button>
              ))}
            </nav>
          )}

          {detail && (
            <>
              <section aria-labelledby="case-heading" className="card">
                <h2 id="case-heading">Case file</h2>
                <dl className="case">
                  <dt>Reference</dt>
                  <dd data-testid="case-reference">{detail.reference}</dd>
                  <dt>Client</dt>
                  <dd data-testid="case-client">{detail.clientName}</dd>
                  <dt>Route</dt>
                  <dd data-testid="case-route">
                    {detail.origin && detail.destination
                      ? `${detail.origin} → ${detail.destination}`
                      : 'Route not recorded'}
                  </dd>
                  <dt>Goods</dt>
                  <dd data-testid="case-goods">{goodsSummary(detail.consignment)}</dd>
                  <dt>Current stage</dt>
                  <dd data-testid="case-stage">{SHIPMENT_STATUS_LABELS[detail.stage]}</dd>
                </dl>
                {detail.holdReason && (
                  <p className="hold" data-testid="case-hold">
                    On hold: {detail.holdReason}
                  </p>
                )}
              </section>

              {user.role === 'client_viewer' && <CaseStatus token={token} caseId={detail.id} />}

              {user.role === 'client_viewer' && <ValuationQuery token={token} caseId={detail.id} />}

              {user.role === 'client_viewer' && (
                <ComplianceAssistant token={token} caseId={detail.id} />
              )}

              {user.role === 'client_viewer' && !detail.assignedAgentId && (
                <AgentDirectory token={token} caseId={detail.id} onAppointed={handleAppointed} />
              )}

              {user.role === 'client_viewer' && <Checklist token={token} caseId={detail.id} />}

              <section aria-labelledby="timeline-heading" className="card">
                <h2 id="timeline-heading">Stage history</h2>
                <p className="hint">Read-only timeline from the shipment event log.</p>
                {detail.events.length === 0 ? (
                  <p className="empty">No stage changes recorded yet.</p>
                ) : (
                  <ol className="timeline">
                    {detail.events.map((event) => (
                      <li key={event.id} className="timeline__item">
                        <span className="timeline__stage">
                          {SHIPMENT_STATUS_LABELS[event.toStage]}
                        </span>
                        <span className="timeline__meta">
                          {new Date(event.createdAt).toLocaleString()} ·{' '}
                          {event.actorUserId ? `by ${event.actorUserId.slice(0, 8)}` : 'by system'}
                        </span>
                        {event.note && <p className="timeline__note">{event.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </>
      )}

      <section aria-labelledby="mockups-heading" style={{ marginTop: '1.5rem' }}>
        <button type="button" onClick={() => setShowMockups((value) => !value)}>
          {showMockups ? 'Hide' : 'Show'} importer workflow mock screens
        </button>
        {showMockups ? (
          <div style={{ marginTop: '1rem' }}>
            <Mockups />
          </div>
        ) : null}
      </section>
    </main>
  );
}
