import { useEffect, useState } from 'react';
import { api, messageOf, type NotificationView } from './api';

const EVENT_LABELS: Record<string, string> = {
  'review.sent': 'Review sent',
  'review.queried': 'Importer query',
  'review.approved': 'Review approved',
  'invoice.issued': 'Invoice issued',
  'payment.recorded': 'Payment recorded',
};

function channelLabel(channel: NotificationView['channel']): string {
  if (channel === 'sms_mock') return 'SMS mock — nothing sent';
  if (channel === 'mock') return 'Mock — nothing sent';
  return 'Email webhook';
}

/**
 * Real delivery status from the append-only outbox. The default channels record
 * an outcome without transmitting anything; this is stated on the screen rather
 * than implying a message was delivered.
 */
export function NotificationStatus({ token }: { token: string }) {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.listNotifications(token);
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
    <section className="card workflow" aria-labelledby="notification-status-heading">
      <h2 id="notification-status-heading">Notification status</h2>
      <p className="hint" data-testid="notification-notice">
        Recorded outcomes only. The SMS mock records a skipped result and sends nothing; real SMS,
        WhatsApp and live border feeds are roadmap. No recipient number is shown here.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {busy && <p className="empty">Loading delivery outcomes…</p>}
      {!busy && !error && items.length === 0 && (
        <p className="empty">No delivery outcomes have been recorded yet.</p>
      )}
      {items.length > 0 && (
        <ul className="notice-list">
          {items.map((item) => (
            <li className="notice-list__item" key={item.id} data-testid="notification-row">
              <strong>{EVENT_LABELS[item.eventType] ?? item.eventType}</strong>
              <span className="notice-list__meta">
                <span
                  className={`badge ${item.status === 'sent' ? 'badge--ok' : 'badge--warn'}`}
                  data-testid="notification-status-value"
                >
                  {item.status}
                </span>
                <span>{channelLabel(item.channel)}</span>
              </span>
              <span className="notice-list__sub">{item.subject}</span>
              {item.detail && <span className="notice-list__sub">{item.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
