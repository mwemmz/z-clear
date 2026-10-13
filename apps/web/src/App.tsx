import { SHIPMENT_STAGES } from '@app/shared';

const STAGE_LABELS: Record<string, string> = {
  docs_received: 'Documents received',
  submitted: 'Submitted to customs',
  duty_assessed: 'Duty assessed',
  duty_paid: 'Duty paid',
  released: 'Released',
  in_transit: 'In transit',
  delivered: 'Delivered',
};

export function App() {
  return (
    <main className="shell">
      <header className="shell__header">
        <h1>Clearing Agent Platform</h1>
        <p className="shell__subtitle">Phase 0 scaffold</p>
      </header>

      <section aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading">Shipment pipeline</h2>
        <ol className="pipeline">
          {SHIPMENT_STAGES.map((stage) => (
            <li key={stage} className="pipeline__item">
              {STAGE_LABELS[stage] ?? stage}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
