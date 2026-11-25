import { MockScreen } from './MockScreen';

/** Cross (border) check-in screen (sample data). */
export function MockCrossCheckIn() {
  return (
    <MockScreen label="Cross check-in" note="One-tap check-in when the truck reaches the border.">
      <dl className="mock-kv">
        <dt>Shipment</dt>
        <dd>DEMO-IMPORT-0001</dd>
        <dt>Border post</dt>
        <dd>Kasumbalesa</dd>
        <dt>Stage before check-in</dt>
        <dd>Released</dd>
      </dl>
      <div className="mock-actions">
        <button type="button" className="mock-btn">
          Check in
        </button>
        <button type="button" className="mock-btn mock-btn--secondary">
          Report an issue
        </button>
      </div>
      <p className="mock-hint">
        Offline-tolerant: the tap queues locally and syncs when the network returns. Status feeding
        remains manual — no ASYCUDA integration.
      </p>
    </MockScreen>
  );
}
