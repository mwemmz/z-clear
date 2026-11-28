import { WarningCircle } from '@phosphor-icons/react';
import { MockScreen } from './MockScreen';

/** The offline/outage message. The saved draft stays local; nothing is filed. */
export function MockOutageBanner() {
  return (
    <MockScreen
      label="ASYCUDA outage notice"
      note="What an importer sees when filing is unavailable."
    >
      <div className="outage-banner">
        <WarningCircle size={24} aria-hidden="true" />
        <div>
          <strong>ASYCUDA unavailable</strong>
          <p>
            Your approved draft is saved. Your agent will file it manually when the service returns.
          </p>
        </div>
      </div>
      <p className="mock-hint">Z Clear never files for you and has no live ASYCUDA status feed.</p>
    </MockScreen>
  );
}
