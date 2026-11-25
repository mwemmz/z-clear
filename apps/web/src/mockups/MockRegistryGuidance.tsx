import { MockScreen } from './MockScreen';

const STEPS = [
  { label: 'ZRA TPIN registration', done: true },
  { label: 'Register with the agents registry', done: true },
  { label: 'VAT certificate (if registered)', done: false },
  { label: 'Bank or mobile-money payout account', done: false },
];

/** Registry guidance screen (sample data). */
export function MockRegistryGuidance() {
  return (
    <MockScreen label="Registry guidance" note="What an importer needs before first clearance.">
      <ol className="mock-steps">
        {STEPS.map((step) => (
          <li key={step.label} className={step.done ? 'is-done' : 'is-todo'}>
            <span aria-hidden="true">{step.done ? '✓' : '○'}</span>
            {step.label}
          </li>
        ))}
      </ol>
      <p className="mock-hint">
        Guidance content is config data per agency; nothing here files anything with ZRA — customs
        stays manual in ASYCUDA World.
      </p>
    </MockScreen>
  );
}
