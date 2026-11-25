import { MockScreen } from './MockScreen';

const MESSAGES = [
  { time: '09:14', text: 'DEMO-IMPORT-0001: documents received.' },
  { time: '11:02', text: 'DEMO-IMPORT-0001: submitted to customs.' },
  { time: '14:47', text: 'DEMO-IMPORT-0001: review sent — please confirm details.' },
];

/** SMS status notification screen (sample data). */
export function MockSmsStatus() {
  return (
    <MockScreen label="SMS status updates" note="What the importer receives as stage changes land.">
      <ul className="mock-sms">
        {MESSAGES.map((message) => (
          <li key={message.time}>
            <span className="mock-sms__time">{message.time}</span>
            <span className="mock-sms__text">{message.text}</span>
          </li>
        ))}
      </ul>
      <p className="mock-hint">
        Notifications ride the (Phase 4) job queue behind a provider interface; this is the mock
        channel output.
      </p>
    </MockScreen>
  );
}
