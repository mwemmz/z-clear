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
      <svg
        className="route-diagram"
        viewBox="0 0 220 48"
        role="img"
        aria-label="Static route diagram from Ndola to Kasumbalesa"
      >
        <path d="M12 24 H208" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="12" cy="24" r="6" fill="currentColor" />
        <circle cx="208" cy="24" r="6" fill="currentColor" />
        <text x="12" y="44" textAnchor="start">
          Ndola
        </text>
        <text x="208" y="44" textAnchor="end">
          Kasumbalesa
        </text>
      </svg>
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
