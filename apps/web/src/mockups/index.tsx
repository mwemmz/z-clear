/**
 * Static labelled mock screens still retained for demo comparison (sample data
 * only, no API calls): Zamtel SIM sign-up/PIN and Zamtel Money fee payment.
 * Agent reviews, driver check-in, notification status and registry guidance
 * are real workflows in `AgentReviews.tsx`, `DriverCheckIn.tsx`,
 * `NotificationStatus.tsx` and `RegistryGuidance.tsx`.
 */
import { MockScreen } from './MockScreen';
import { MockSignupPin } from './MockSignupPin';
import { MockZamtelPayment } from './MockZamtelPayment';

export function Mockups() {
  return (
    <div className="mockups">
      <MockSignupPin />
      <MockZamtelPayment />
    </div>
  );
}

export { MockScreen };
