import { useState, type FormEvent } from 'react';
import { SHIPMENT_STATUS_LABELS } from '@zclear/shared';
import { api, messageOf, type ShipmentDetail } from './api';

interface DriverCheckInProps {
  token: string;
  shipment: ShipmentDetail;
  onCheckedIn: () => Promise<void>;
}

/** Real, manual check-in for the driver assigned to this shipment. */
export function DriverCheckIn({ token, shipment, onCheckedIn }: DriverCheckInProps) {
  const [borderPost, setBorderPost] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.checkInShipment(token, shipment.id, {
        borderPost: borderPost.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      await onCheckedIn();
      setMessage(
        `Check-in recorded at ${borderPost.trim()}. The stage is unchanged: ${SHIPMENT_STATUS_LABELS[shipment.stage]}.`,
      );
      setBorderPost('');
      setNote('');
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  const checkIns = shipment.events.filter((event) => event.source === 'driver');

  return (
    <section className="card workflow" aria-labelledby="driver-checkin-heading">
      <h2 id="driver-checkin-heading">Driver check-in</h2>
      <p className="hint">
        Manual record only. There is no live border feed, no ASYCUDA update and no stage change.
      </p>
      <dl className="workflow__facts">
        <dt>Shipment</dt>
        <dd data-testid="driver-shipment">{shipment.reference}</dd>
        <dt>Route</dt>
        <dd>
          {shipment.origin ?? 'Origin not recorded'} →{' '}
          {shipment.destination ?? 'Destination not recorded'}
        </dd>
        <dt>Recorded stage</dt>
        <dd>{SHIPMENT_STATUS_LABELS[shipment.stage]}</dd>
      </dl>
      <form className="workflow__form" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="border-post">Border post</label>
        <input
          id="border-post"
          name="borderPost"
          value={borderPost}
          onChange={(event) => setBorderPost(event.target.value)}
          maxLength={200}
          required
        />
        <label htmlFor="checkin-note">Note (optional)</label>
        <textarea
          id="checkin-note"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={2}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Recording…' : 'Record check-in'}
        </button>
      </form>
      {message && (
        <p className="hint" role="status" data-testid="checkin-status">
          {message}
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {checkIns.length > 0 && (
        <ul className="timeline" aria-label="Recorded check-ins">
          {checkIns.map((event) => (
            <li className="timeline__item" key={event.id}>
              <span className="timeline__stage">Manual check-in</span>
              <span className="timeline__meta">
                {new Date(event.createdAt).toLocaleString()} · {event.note ?? 'No note'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
