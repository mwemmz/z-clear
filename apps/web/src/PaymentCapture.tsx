import { useEffect, useState, type FormEvent } from 'react';
import { formatMoney, type CurrencyCode } from '@zclear/shared';
import { api, messageOf, type InvoiceSummary } from './api';

const METHODS = ['cash', 'bank_transfer', 'mobile_money', 'card', 'other'] as const;
type PaymentMethod = (typeof METHODS)[number];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money (off-platform)',
  card: 'Card',
  other: 'Other',
};

/** ZMW major units entered by staff become integer minor units at the edge. */
function minorUnits(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return Number.NaN;
  return Math.round(amount * 100);
}

function money(amountMinor: number): string {
  return formatMoney({ amountMinor, currency: 'ZMW' as CurrencyCode });
}

/**
 * Real invoice/payment workflow over the existing billing API. This records an
 * agency observation of an off-platform payment; it integrates with no payment
 * provider and never represents duty, VAT or a ZRA assessment.
 */
export function PaymentCapture({ token, canRecord }: { token: string; canRecord: boolean }) {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('mobile_money');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.listInvoices(token);
        if (!cancelled) {
          setInvoices(result);
          setSelectedId(
            result.find((invoice) => invoice.balanceMinor > 0)?.id ?? result[0]?.id ?? null,
          );
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

  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;
  const payable = selected?.status === 'issued' || selected?.status === 'partially_paid';

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || !payable) return;
    const amountMinor = minorUnits(amount);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setError('Enter a positive amount in ZMW.');
      return;
    }
    if (amountMinor > selected.balanceMinor) {
      setError('Amount cannot exceed the derived balance.');
      return;
    }
    setSaving(true);
    setError(null);
    setConfirmation(null);
    try {
      await api.recordPayment(token, selected.id, {
        amountMinor,
        method,
        ...(reference ? { reference } : {}),
        paidOn,
        ...(note ? { note } : {}),
      });
      setInvoices(await api.listInvoices(token));
      setConfirmation(
        `${money(amountMinor)} recorded against ${selected.number}. No money was moved by this app.`,
      );
      setAmount('');
      setReference('');
      setNote('');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card workflow" aria-labelledby="payment-heading">
      <h2 id="payment-heading">Invoices &amp; payments</h2>
      <p className="hint" data-testid="payment-notice">
        Agency-issued invoices only. Recording a payment is a manual observation of money paid
        off-platform — there is no Zamtel Money or bank integration, and this is not a ZRA
        assessment or a customs payment. Balances are derived from recorded payments.
      </p>
      {error && (
        <p className="alert" role="alert" data-testid="payment-error">
          {error}
        </p>
      )}
      {confirmation && (
        <p className="hint" role="status" data-testid="payment-confirmation">
          {confirmation}
        </p>
      )}
      {busy && <p className="empty">Loading invoices…</p>}
      {!busy && !error && invoices.length === 0 && (
        <p className="empty">No invoices have been issued for this case yet.</p>
      )}
      {invoices.length > 0 && (
        <>
          <ul className="invoice-list">
            {invoices.map((invoice) => (
              <li
                className="invoice-list__item"
                key={invoice.id}
                data-testid="invoice-row"
                aria-current={invoice.id === selectedId ? 'true' : undefined}
              >
                <button type="button" onClick={() => setSelectedId(invoice.id)}>
                  <strong>{invoice.number}</strong>
                  <span className="invoice-list__sub">{invoice.status.replaceAll('_', ' ')}</span>
                </button>
                <span className="invoice-list__meta">
                  <span>Total {money(invoice.totalMinor)}</span>
                  <span>Paid {money(invoice.amountPaidMinor)}</span>
                  <strong>Balance {money(invoice.balanceMinor)}</strong>
                </span>
                {invoice.lines.map((line) => (
                  <span className="invoice-list__sub" key={line.chargeType}>
                    {line.description} — {money(line.lineAmountMinor)} ({line.chargeType})
                  </span>
                ))}
                {invoice.notes && <span className="invoice-list__sub">{invoice.notes}</span>}
              </li>
            ))}
          </ul>

          {canRecord && payable && selected && (
            <form className="workflow__form" onSubmit={(event) => void submit(event)}>
              <label>
                Amount (ZMW)
                <input
                  aria-label="Payment amount in ZMW"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
              <label>
                Method
                <select
                  aria-label="Payment method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                >
                  {METHODS.map((value) => (
                    <option key={value} value={value}>
                      {METHOD_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference (optional)
                <input
                  aria-label="Payment reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Paid on
                <input
                  aria-label="Date paid"
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                  required
                />
              </label>
              <label>
                Note (optional)
                <textarea
                  aria-label="Payment note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                />
              </label>
              <button type="submit" disabled={saving}>
                {saving ? 'Recording…' : 'Record payment'}
              </button>
            </form>
          )}
          {!canRecord && (
            <p className="hint">Only agency staff can record a payment against an invoice.</p>
          )}
        </>
      )}
    </section>
  );
}
