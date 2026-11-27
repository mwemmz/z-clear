import { useState, type FormEvent } from 'react';
import { api, messageOf, type CreateCaseInput, type ShipmentSummary } from './api';

interface Props {
  token: string;
  onCreated: (shipment: ShipmentSummary) => void;
}

/** User-entered ZMW amounts are converted to integer minor units at the edge. */
function minorUnits(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return Number.NaN;
  return Math.round(amount * 100);
}

/**
 * Minimal phone-first case form. All amounts are user-supplied declarations;
 * no duty, VAT or fee is calculated here. The consignment shape matches the
 * shared zod schema used by the API.
 */
export function CaseForm({ token, onCreated }: Props) {
  const [kind, setKind] = useState<'vehicle' | 'goods'>('vehicle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    const amount = minorUnits(text(kind === 'vehicle' ? 'purchasePrice' : 'value'));

    if (!Number.isFinite(amount)) {
      setError('Enter a valid amount in ZMW.');
      return;
    }

    const details =
      kind === 'vehicle'
        ? {
            make: text('make'),
            model: text('model'),
            year: Number(text('year')),
            vinOrChassis: text('vinOrChassis'),
            engine: text('engine'),
            purchasePriceMinor: amount,
            currency: 'ZMW',
            origin: text('origin'),
            portOfEntry: text('portOfEntry'),
          }
        : {
            description: text('description'),
            hsCode: text('hsCode') || undefined,
            quantity: Number(text('quantity')),
            unit: text('unit'),
            valueMinor: amount,
            currency: 'ZMW',
            origin: text('origin'),
            portOfEntry: text('portOfEntry'),
          };

    const input: CreateCaseInput = {
      clientName: text('clientName'),
      clientContact: text('clientContact'),
      consignment: { caseKind: kind, [kind]: details },
    };

    setBusy(true);
    setError(null);
    try {
      const created = await api.createCase(token, input);
      onCreated(created);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="new-case-heading" className="card">
      <h2 id="new-case-heading">Open a case</h2>
      <p className="hint">Your details are saved to your own case before you appoint an agent.</p>
      <form className="login" onSubmit={(event) => void submit(event)}>
        <label htmlFor="case-kind">Case type</label>
        <select
          id="case-kind"
          name="caseKind"
          value={kind}
          onChange={(event) => setKind(event.target.value as 'vehicle' | 'goods')}
        >
          <option value="vehicle">Vehicle</option>
          <option value="goods">Goods</option>
        </select>

        <label htmlFor="clientName">Your name</label>
        <input id="clientName" name="clientName" required maxLength={200} />
        <label htmlFor="clientContact">Phone or email</label>
        <input id="clientContact" name="clientContact" required maxLength={320} />

        {kind === 'vehicle' ? (
          <>
            <label htmlFor="make">Make</label>
            <input id="make" name="make" required maxLength={100} />
            <label htmlFor="model">Model</label>
            <input id="model" name="model" required maxLength={100} />
            <label htmlFor="year">Year</label>
            <input id="year" name="year" type="number" min={1900} max={2100} required />
            <label htmlFor="vinOrChassis">VIN or chassis</label>
            <input id="vinOrChassis" name="vinOrChassis" required maxLength={64} />
            <label htmlFor="engine">Engine</label>
            <input id="engine" name="engine" required maxLength={100} />
            <label htmlFor="purchasePrice">Purchase price (ZMW)</label>
            <input
              id="purchasePrice"
              name="purchasePrice"
              type="number"
              min={0}
              step="0.01"
              required
            />
          </>
        ) : (
          <>
            <label htmlFor="description">Goods description</label>
            <input id="description" name="description" required maxLength={500} />
            <label htmlFor="hsCode">HS code (optional, if you know it)</label>
            <input id="hsCode" name="hsCode" inputMode="numeric" maxLength={10} />
            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" name="quantity" type="number" min={1} step={1} required />
            <label htmlFor="unit">Unit</label>
            <input id="unit" name="unit" required maxLength={50} />
            <label htmlFor="value">Declared value (ZMW)</label>
            <input id="value" name="value" type="number" min={0} step="0.01" required />
          </>
        )}

        <label htmlFor="origin">Origin</label>
        <input id="origin" name="origin" required maxLength={200} />
        <label htmlFor="portOfEntry">Port of entry</label>
        <input id="portOfEntry" name="portOfEntry" required maxLength={200} />

        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Create case'}
        </button>
      </form>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
