import { SHIPMENT_STAGES, SHIPMENT_STATUS_LABELS } from '@zclear/shared';

export function App() {
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
    </main>
  );
}
