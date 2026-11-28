import { MockScreen } from './MockScreen';

/** Feature-phone USSD menu. Static sample; it sends no USSD request. */
export function MockUssdLite() {
  return (
    <MockScreen label="USSD-lite menu" note="For phones without data access.">
      <div className="ussd-frame" role="img" aria-label="Sample USSD menu with three options">
        <div className="ussd-frame__screen">
          <p>*880#</p>
          <p>1. Check my case</p>
          <p>2. Approve draft</p>
          <p>3. Call agent</p>
          <p>0. Back</p>
        </div>
        <p>Sample menu only. No network request is made.</p>
      </div>
      <p className="mock-hint">Plain numbered choices, readable on a small phone screen.</p>
    </MockScreen>
  );
}
