/**
 * Static labelled mock screens still retained for demo comparison (sample data
 * only, no API calls): Zamtel SIM sign-up/PIN, 3-step registry guidance and
 * Zamtel Money fee payment. Agent reviews, driver check-in and notification
 * status are now real workflows in `AgentReviews.tsx`, `DriverCheckIn.tsx` and
 * `NotificationStatus.tsx`.
 */
import { MockScreen } from './MockScreen';
import { MockSignupPin } from './MockSignupPin';
import { MockRegistryGuidance } from './MockRegistryGuidance';
import { MockZamtelPayment } from './MockZamtelPayment';

export function Mockups() {
  return (
    <div className="mockups">
      <MockSignupPin />
      <MockRegistryGuidance />
      <MockZamtelPayment />
    </div>
  );
}

export { MockScreen };
