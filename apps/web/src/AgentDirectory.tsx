import { useEffect, useState, type FormEvent } from 'react';
import { api, messageOf, type AgentDirectoryEntry, type AppointmentResult } from './api';

interface Props {
  token: string;
  caseId: string;
  onAppointed: (result: AppointmentResult) => void;
}

const DEFAULT_CONSENT =
  'I consent to transfer this case and my importer account to the agency I selected.';

/**
 * Importer-facing directory and one-tap appointment. The API exposes only
 * published, curated agency fields; ZRA licence status is labelled SIMULATED
 * until a real source is verified. Appointment moves the case out of the
 * importer's personal tenant, so the user must sign in again afterwards.
 */
export function AgentDirectory({ token, caseId, onAppointed }: Props) {
  const [agents, setAgents] = useState<AgentDirectoryEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [consentText, setConsentText] = useState(DEFAULT_CONSENT);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listAgentProfiles(token)
      .then((entries) => {
        if (!active) return;
        setAgents(entries);
        setSelectedUserId(entries[0]?.userId ?? null);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedUserId || !agreed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.appointAgent(token, {
        caseId,
        agentUserId: selectedUserId,
        consentText,
      });
      onAppointed(result);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="agent-directory-heading"
      className="card"
      data-testid="agent-directory"
    >
      <h2 id="agent-directory-heading">Choose a clearing agent</h2>
      <p className="hint" data-testid="agent-directory-notice">
        Agency licence status is shown as simulated, pending ZRA API. Z Clear does not verify or
        register agents with ZRA.
      </p>
      {error && <p className="alert">{error}</p>}
      {agents.length === 0 && !error && <p className="hint">Loading agencies…</p>}
      {agents.length === 0 && !error && (
        <p className="empty">No published agencies are available.</p>
      )}
      {agents.length > 0 && (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <fieldset className="agent-options">
            <legend>Available agencies</legend>
            {agents.map((agent) => (
              <label key={agent.id} className="agent-option" data-testid={`agent-${agent.id}`}>
                <input
                  type="radio"
                  name="agentUserId"
                  value={agent.userId}
                  checked={selectedUserId === agent.userId}
                  onChange={() => setSelectedUserId(agent.userId)}
                />
                <span>
                  <strong>{agent.agencyName}</strong>
                  <small>
                    {agent.location}
                    {agent.serviceArea ? ` · ${agent.serviceArea}` : ''}
                    {agent.languages ? ` · ${agent.languages}` : ''}
                  </small>
                  <small className="badge badge--warn" data-testid={`agent-licence-${agent.id}`}>
                    {agent.licenceNotice}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="consent-text">Your consent</label>
          <textarea
            id="consent-text"
            value={consentText}
            rows={3}
            maxLength={500}
            onChange={(event) => setConsentText(event.target.value)}
          />
          <label className="check" htmlFor="consent-agree">
            <input
              id="consent-agree"
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            I understand my case and importer account will move to this agency and I must sign in
            again.
          </label>
          <button
            type="submit"
            disabled={busy || !agreed || !selectedUserId || consentText.trim().length < 10}
          >
            {busy ? 'Appointing…' : 'Appoint this agent'}
          </button>
        </form>
      )}
    </section>
  );
}
