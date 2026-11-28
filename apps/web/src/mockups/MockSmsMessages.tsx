import { MockScreen } from './MockScreen';

/** Sample SMS thread. The outbox in the real app states that nothing is sent. */
export function MockSmsMessages() {
  return (
    <MockScreen label="SMS messages" note="How a query and answer would read on a phone.">
      <div className="sms-thread">
        <p className="sms-thread__bubble">
          Case ZCLR-2041: your agent sent revision 3. Reply QUERY if something looks wrong.
        </p>
        <p className="sms-thread__bubble sms-thread__bubble--out">QUERY declared value</p>
        <p className="sms-thread__bubble">
          Received. Your agent will check it. Customs steps still happen in ASYCUDA World.
        </p>
      </div>
      <p className="mock-hint">Sample, not ZRA figures. No message is sent by this mock.</p>
    </MockScreen>
  );
}
