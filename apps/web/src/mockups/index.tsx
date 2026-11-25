/**
 * Static labelled mock screens for the importer review workflow (Dev 1 owns
 * this directory; sample data only, no API calls). Six screens:
 * Zamtel SIM sign-up + PIN, registry guidance, SMS status, Zamtel Money fee
 * payment, agent reviews, and the Cross check-in screen.
 */
import { MockScreen } from './MockScreen';
import { MockSignupPin } from './MockSignupPin';
import { MockRegistryGuidance } from './MockRegistryGuidance';
import { MockSmsStatus } from './MockSmsStatus';
import { MockZamtelPayment } from './MockZamtelPayment';
import { MockAgentReviews } from './MockAgentReviews';
import { MockCrossCheckIn } from './MockCrossCheckIn';

export function Mockups() {
  return (
    <div className="mockups">
      <MockSignupPin />
      <MockRegistryGuidance />
      <MockSmsStatus />
      <MockZamtelPayment />
      <MockAgentReviews />
      <MockCrossCheckIn />
    </div>
  );
}

export { MockScreen };
