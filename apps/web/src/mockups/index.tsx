/**
 * Static labelled mock screens (sample data only, no API calls): Zamtel-style
 * sign-up/PIN, fee payment, USSD-lite, SMS, border check-in, agent reviews,
 * an outage notice and a cost check. Real workflows live in the top-level
 * feature components and are always labelled separately.
 */
import { MockScreen } from './MockScreen';
import { MockAgentReviews } from './MockAgentReviews';
import { MockCostCheck } from './MockCostCheck';
import { MockCrossCheckIn } from './MockCrossCheckIn';
import { MockOutageBanner } from './MockOutageBanner';
import { MockSignupPin } from './MockSignupPin';
import { MockSmsMessages } from './MockSmsMessages';
import { MockUssdLite } from './MockUssdLite';
import { MockZamtelPayment } from './MockZamtelPayment';

export function Mockups() {
  return (
    <div className="mockups">
      <MockUssdLite />
      <MockSmsMessages />
      <MockCrossCheckIn />
      <MockOutageBanner />
      <MockCostCheck />
      <MockAgentReviews />
      <MockSignupPin />
      <MockZamtelPayment />
    </div>
  );
}

export { MockScreen };
