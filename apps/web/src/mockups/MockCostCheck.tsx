import { MockScreen } from './MockScreen';

/** Cost check mock: only a labelled agency fee; no duty, VAT or tax figures. */
export function MockCostCheck() {
  return (
    <MockScreen label="Cost check" note="What the app can show without a verified tariff rule.">
      <dl className="mock-kv">
        <dt>Agency service fee</dt>
        <dd className="sample-figures">K 450.00 (sample, not ZRA figures)</dd>
        <dt>Duty / VAT / tax</dt>
        <dd>No verified rule. Decided in ASYCUDA World.</dd>
        <dt>Payment effect</dt>
        <dd>Records an off-platform payment only. No money moves here.</dd>
      </dl>
      <p className="mock-hint">Never pay or file on a sample figure.</p>
    </MockScreen>
  );
}
