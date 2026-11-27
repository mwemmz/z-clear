import { useEffect, useState, type FormEvent } from 'react';
import { formatMoney, type CurrencyCode } from '@zclear/shared';
import { api, messageOf, type ComplianceAssistantResult, type EstimateResult } from './api';

interface Props {
  token: string;
  caseId: string;
}

const REFUSAL_COPY: Record<string, string> = {
  no_verified_rule:
    'There is no verified tariff rule for this code. Ask your agency — Z Clear will not guess a figure.',
  sample_mode_disabled:
    'A sample rule exists, but sample mode is off. No illustrative figure is shown.',
  invalid_input: 'Check the HS code and value you entered.',
};

/** Phone-first compliance card. Never a customs assessment or legal advice. */
export function ComplianceAssistant({ token, caseId }: Props) {
  const [assistant, setAssistant] = useState<ComplianceAssistantResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hsCode, setHsCode] = useState('');
  const [value, setValue] = useState('');
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setAssistant(null);
    setError(null);
    api
      .getComplianceAssistant(token, caseId)
      .then((result) => {
        if (active) setAssistant(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [token, caseId]);

  async function handleEstimate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const major = Number(value);
    if (!Number.isFinite(major) || major < 0) {
      setError('Enter a valid value.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setEstimate(
        await api.requestEstimate(token, {
          hsCode: hsCode.trim(),
          customsValueMinor: Math.round(major * 100),
          currency: 'ZMW',
        }),
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="compliance-heading" className="card">
      <h2 id="compliance-heading">Before you import</h2>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {!assistant && !error && <p className="hint">Loading your questions…</p>}

      {assistant && (
        <>
          <p className="hint" data-testid="compliance-notice">
            {assistant.notice}
          </p>
          {assistant.prompts.length === 0 ? (
            <p className="empty">Your agency has not configured any prompts for this case yet.</p>
          ) : (
            <ul className="compliance-prompts" data-testid="compliance-prompts">
              {assistant.prompts.map((prompt) => (
                <li key={prompt.id} className="compliance-prompt">
                  <span>{prompt.text}</span>
                  <span className="compliance-provenance">
                    {prompt.verificationStatus ?? 'No source recorded'}
                    {prompt.sourceUrl ? ` · Source: ${prompt.sourceUrl}` : ''}
                    {prompt.effectiveDate ? ` · Effective ${prompt.effectiveDate}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <form className="estimate-form" onSubmit={(event) => void handleEstimate(event)}>
        <h3>Illustrative figure</h3>
        <p className="hint">
          Only a confirmed tariff rule can produce a figure. Z Clear never assesses duty or decides
          customs value.
        </p>
        <label htmlFor="estimate-hs">HS code</label>
        <input
          id="estimate-hs"
          inputMode="numeric"
          value={hsCode}
          onChange={(event) => setHsCode(event.target.value)}
          placeholder="6 to 10 digits"
          pattern="[0-9]{6,10}"
          required
        />
        <label htmlFor="estimate-value">Value in ZMW</label>
        <input
          id="estimate-value"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0.00"
          required
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Check for a verified figure'}
        </button>
      </form>

      {estimate?.kind === 'refused' && (
        <p className="alert" data-testid="estimate-refusal">
          {REFUSAL_COPY[estimate.reason] ?? 'No figure is available.'} {estimate.notice}
        </p>
      )}
      {estimate?.kind === 'estimate' && (
        <dl className="estimate" data-testid="estimate-result">
          <dt>Illustrative figure</dt>
          <dd data-testid="estimate-amount">
            {formatMoney({
              amountMinor: estimate.amountMinor,
              currency: estimate.currency as CurrencyCode,
            })}
          </dd>
          <dt>Basis</dt>
          <dd data-testid="estimate-basis">
            {estimate.basis === 'SAMPLE'
              ? 'SAMPLE — illustrative only, do not pay or file'
              : 'Verified source'}
          </dd>
          <dt>Verification</dt>
          <dd>{estimate.rule.verificationStatus}</dd>
          <dt>Source</dt>
          <dd>{estimate.rule.sourceUrl}</dd>
          <dt>Effective</dt>
          <dd>{estimate.rule.effectiveDate}</dd>
        </dl>
      )}
      {estimate?.kind === 'estimate' && (
        <p className="hint" data-testid="estimate-notice">
          {estimate.notice}
        </p>
      )}
    </section>
  );
}
