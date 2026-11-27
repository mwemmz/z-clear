/**
 * Static labelled mock screens still retained for demo comparison (sample data
 * only, no API calls): Zamtel SIM sign-up/PIN, 3-step registry guidance, SMS
 * status and Zamtel Money fee payment. Agent reviews and driver check-in are
 * now real workflows in `AgentReviews.tsx` and `DriverCheckIn.tsx`.
 */
import { MockScreen } from './MockScreen';
import { MockSignupPin } from './MockSignupPin';
import { MockRegistryGuidance } from './MockRegistryGuidance';
import { MockSmsStatus } from './MockSmsStatus';
import { MockZamtelPayment } from './MockZamtelPayment';

export function Mockups() {
  return (
    <div className="mockups">
      <MockSignupPin />
      <MockRegistryGuidance />
      <MockSmsStatus />
      <MockZamtelPayment />
    </div>
  );
}

export { MockScreen };
