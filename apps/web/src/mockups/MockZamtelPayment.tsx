import { MockScreen } from './MockScreen';

/**
 * Zamtel Money fee payment screen. The "fee" here is the agency's own service
 * fee for the demo — no duty, tax or ZRA amounts appear anywhere, because we
 * never invent customs figures.
 */
export function MockZamtelPayment() {
  return (
    <MockScreen
      label="Zamtel Money fee payment"
      note="Paying the agency service fee from the phone."
    >
      <dl className="mock-kv">
        <dt>Agency</dt>
        <dd>Demo Clearing Agency</dd>
        <dt>Service fee (agency only)</dt>
        <dd>ZMW 450.00</dd>
        <dt>Customs duty / VAT</dt>
        <dd>Assessed in ASYCUDA World — not payable here</dd>
        <dt>Wallet</dt>
        <dd>+260 95 000 0000 (Zamtel Money)</dd>
      </dl>
      <button type="button" className="mock-btn">
        Pay with Zamtel Money
      </button>
      <p className="mock-hint">
        Only the agency's own service fee is collectable in-app; duty/VAT figures come from the
        assessment and stay out of the payment flow.
      </p>
    </MockScreen>
  );
}
