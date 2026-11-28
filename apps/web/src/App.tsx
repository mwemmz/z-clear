import { useEffect, useRef, useState, type FormEvent } from 'react';
import { List } from '@phosphor-icons/react';
import { SHIPMENT_STATUS_LABELS } from '@zclear/shared';
import { AgentDirectory } from './AgentDirectory';
import { AgentReviews } from './AgentReviews';
import { CaseForm } from './CaseForm';
import { CaseStatus } from './CaseStatus';
import { Checklist } from './Checklist';
import { DriverCheckIn } from './DriverCheckIn';
import { Mockups } from './mockups';
import { ComplianceAssistant } from './ComplianceAssistant';
import { NotificationStatus } from './NotificationStatus';
import { PaymentCapture } from './PaymentCapture';
import { RegistryGuidance } from './RegistryGuidance';
import { ValuationQuery } from './ValuationQuery';
import { AgentWorkspace, CaseSheet, ImporterHome, ProfilePanel } from './screens';
import { ThemeSwitcher } from './ui';
import { updatedLabelFor } from './updatedLabel';
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
  driver: 'Driver',
};

const STAFF_ROLES = ['agency_owner', 'agent_staff', 'platform_admin'];

type View = 'home' | 'agents' | 'profile';

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<View>('home');
  const [appointmentNotice, setAppointmentNotice] = useState<string | null>(null);
  // A slow initial shipment load must not erase a case the importer has just
  // created while that request was in flight.
  const createdCaseRef = useRef(false);

  const firstId = shipments[0]?.id ?? null;
  const isAgent = user ? STAFF_ROLES.includes(user.role) : false;
  const current = shipments.find((item) => item.id === selectedId) ?? shipments[0] ?? null;
  const recentCases = shipments
    .filter((item) => item.id !== current?.id)
    .map((item) => ({ reference: item.reference, stage: item.stage }));
  const updatedLabel = updatedLabelFor(current?.updatedAt);
  const actionText = detail?.holdReason
    ? `Your agent left a note: ${detail.holdReason}`
    : 'Check the review draft before it is filed in ASYCUDA.';

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
      setView('home');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  function handleCaseCreated(shipment: ShipmentSummary): void {
    createdCaseRef.current = true;
    setShipments((currentCases) => [shipment, ...currentCases]);
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
    setSheetOpen(false);
    setView('home');
  }

  function handleAppointed(_result: AppointmentResult): void {
    // The access token still carries the importer's old tenant claim. Signing
    // out forces a fresh login so the case is visible in the agency tenant.
    handleSignOut();
    setAppointmentNotice('Agent appointed. Sign in again to continue in the agency workspace.');
  }

  const caseSections = (
    <>
      {token && user && shipments.length === 0 && !busy && (
        <p className="empty">No shipments are available for this account yet.</p>
      )}

      {token && user && user.role !== 'driver' && <NotificationStatus token={token} />}

      {token && user && user.role !== 'driver' && <RegistryGuidance token={token} />}

      {token && user && detail && user.role !== 'driver' && (
        <PaymentCapture
          token={token}
          canRecord={STAFF_ROLES.includes(user.role)}
          shipmentId={detail.id}
        />
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

          {isAgent && token && <AgentReviews token={token} shipments={shipments} />}

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

              {user?.role === 'driver' && (
                <DriverCheckIn
                  token={token}
                  shipment={detail}
                  onCheckedIn={async () => {
                    const updated = await api.getShipment(token, detail.id);
                    setDetail(updated);
                  }}
                />
              )}

              {user?.role === 'client_viewer' && <CaseStatus token={token} caseId={detail.id} />}

              {user?.role === 'client_viewer' && (
                <ValuationQuery token={token} caseId={detail.id} />
              )}

              {user?.role === 'client_viewer' && (
                <ComplianceAssistant token={token} caseId={detail.id} />
              )}

              {user?.role === 'client_viewer' && !detail.assignedAgentId && view !== 'agents' && (
                <AgentDirectory token={token} caseId={detail.id} onAppointed={handleAppointed} />
              )}

              {user?.role === 'client_viewer' && <Checklist token={token} caseId={detail.id} />}

              <section aria-labelledby="timeline-heading" className="card">
                <span className="eyebrow">Audit trail</span>
                <h2 id="timeline-heading">Stage history</h2>
                <p className="hint">
                  Read-only timeline from the shipment event log. Manual agency records; not a ZRA
                  status feed.
                </p>
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
    </>
  );

  return (
    <main className={token ? (isAgent ? 'shell shell--agent' : 'shell') : 'shell shell--login'}>
      <a className="skip-link" href="#case-content">
        Skip to case details
      </a>
      <header className="shell__header">
        <div className="app-brand">
          <span className="app-mark" aria-hidden="true">
            Z
          </span>
          <div>
            <h1 className="app-brand__name">Z Clear</h1>
            <span className="app-brand__tagline">Case operations · manual customs workflow</span>
          </div>
        </div>

        {user && (
          <div className="shell__context">
            <div className="context-item">
              <span className="context-item__label">Role</span>
              <span className="role-badge" data-testid="role-badge">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
            {current && (
              <>
                <div className="context-item">
                  <span className="context-item__label">Case</span>
                  <span className="context-item__value">{current.reference}</span>
                </div>
                <div className="context-item">
                  <span className="context-item__label">Recorded stage</span>
                  <span className="context-item__value">
                    {SHIPMENT_STATUS_LABELS[current.stage]}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="shell__actions">
          {user && (
            <details className="header-menu">
              <summary aria-label="Open account menu">
                <List size={20} aria-hidden="true" /> Account
              </summary>
              <div className="header-menu__panel">
                <ThemeSwitcher compact />
                <button type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </details>
          )}
        </div>
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
        <section className="login-panel" aria-label="Sign in to Z Clear">
          <div className="card login-panel__form">
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
              Credentials are issued by your demo facilitator, not stored in the app.
            </p>
          </div>
          <aside className="card login-panel__guide" aria-labelledby="login-guide-heading">
            <h2 id="login-guide-heading">Four demo roles</h2>
            <p>Each login opens only the work its role is allowed to do.</p>
            <ul className="login-panel__roles">
              <li>
                <strong>Clearing agent</strong>
                <span>Reviews the case, asks questions and records invoices and payments.</span>
              </li>
              <li>
                <strong>Importer / client</strong>
                <span>Sees only their own case, checklist and approval questions.</span>
              </li>
              <li>
                <strong>Platform admin</strong>
                <span>Sets up the demo workspace and checks all tenant workflows.</span>
              </li>
              <li>
                <strong>Driver</strong>
                <span>Sees an assigned shipment and records one manual check-in.</span>
              </li>
            </ul>
            <div>
              <strong>Colour theme</strong>
              <ThemeSwitcher />
            </div>
            <p className="hint">
              Ask your facilitator for the sample email and password. Customs assessment and release
              still happen in ASYCUDA World.
            </p>
          </aside>
        </section>
      )}

      {token && busy && <p className="hint">Loading case file…</p>}

      {token && user?.role === 'client_viewer' && current && (
        <ImporterHome
          reference={current.reference}
          clientName={current.clientName}
          stage={current.stage}
          updatedLabel={updatedLabel}
          actionText={actionText}
          recentCases={recentCases}
          onOpenCase={() => setSheetOpen(true)}
          onNewCase={() => setShowCaseForm(true)}
          onAgents={() => setView('agents')}
          onProfile={() => setView('profile')}
          view={view}
          onHome={() => setView('home')}
        >
          {view === 'agents' &&
            (detail && !detail.assignedAgentId ? (
              <AgentDirectory token={token} caseId={detail.id} onAppointed={handleAppointed} />
            ) : (
              <p className="empty">
                {detail?.assignedAgentId
                  ? 'An agent is already assigned to this case.'
                  : 'Loading available agencies…'}
              </p>
            ))}
          {view === 'profile' && (
            <ProfilePanel
              email={user.email}
              roleLabel={ROLE_LABELS[user.role] ?? user.role}
              onSignOut={handleSignOut}
            />
          )}
        </ImporterHome>
      )}

      {token && user?.role === 'client_viewer' && (
        <section aria-labelledby="new-case-toggle" className="case-form-disclosure">
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

      <div id="case-content">
        {token && user && isAgent ? (
          <AgentWorkspace
            cases={shipments.map((item) => ({
              id: item.id,
              reference: item.reference,
              stage: item.stage,
            }))}
            activeId={selectedId}
            onSelect={setSelectedId}
          >
            {caseSections}
          </AgentWorkspace>
        ) : (
          caseSections
        )}
      </div>

      {token && detail && sheetOpen && (
        <CaseSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          reference={detail.reference}
          route={
            detail.origin && detail.destination
              ? `${detail.origin} → ${detail.destination}`
              : 'Route not recorded'
          }
          stage={detail.stage}
          documentsReady={0}
          documentsTotal={0}
        >
          <p className="hint">
            This case is recorded at {SHIPMENT_STATUS_LABELS[detail.stage]}. Sections below carry
            the current case file, review and payment details.
          </p>
          <p className="provenance">Manual agency record · not submitted to ZRA by this app.</p>
        </CaseSheet>
      )}

      <section aria-labelledby="mockups-heading" className="mock-disclosure">
        <h2 id="mockups-heading" className="sr-only">
          Workflow mock screens
        </h2>
        <button type="button" onClick={() => setShowMockups((value) => !value)}>
          {showMockups ? 'Hide' : 'Show'} importer workflow mock screens
        </button>
        {showMockups ? <Mockups /> : null}
      </section>
    </main>
  );
}
