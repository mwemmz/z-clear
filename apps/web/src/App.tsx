import { useState } from 'react';
import { SHIPMENT_STAGES, SHIPMENT_STATUS_LABELS } from '@zclear/shared';
import { Mockups } from './mockups';

/**
 * The app shell today: the shipment pipeline plus, behind an explicit toggle,
 * the static mock screens for the importer workflow (sample data only).
 */
export function App() {
  const [showMockups, setShowMockups] = useState(false);

  return (
    <main className="shell">
      <header className="shell__header">
        <h1>Z Clear</h1>
        <p className="shell__subtitle">Shipment workspace</p>
      </header>

      <section aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading">Shipment pipeline</h2>
        <ol className="pipeline">
          {SHIPMENT_STAGES.map((stage) => (
            <li key={stage} className="pipeline__item">
              {SHIPMENT_STATUS_LABELS[stage]}
            </li>
          ))}
        </ol>
      </section>

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
