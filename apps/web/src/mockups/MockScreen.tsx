/**
 * Reusable wrapper for static mock screens. Every mock screen renders inside
 * this frame, which carries the screen's label, the "MOCK" badge and a
 * back-of-card note that the content is sample data only — no API calls.
 */
import type { ReactNode } from 'react';

export interface MockScreenProps {
  /** Human label shown in the frame header. */
  label: string;
  /** One-line description of what the screen demonstrates. */
  note?: string;
  children: ReactNode;
}

export function MockScreen({ label, note, children }: MockScreenProps) {
  return (
    <section className="mock-screen" aria-label={`Mock screen: ${label}`}>
      <header className="mock-screen__header">
        <span className="mock-screen__badge" aria-hidden="true">
          MOCK
        </span>
        <h2 className="mock-screen__title">{label}</h2>
      </header>
      {note ? (
        <p className="mock-screen__note">
          {note} Sample data only — no API calls. Controls are shown for layout only.
        </p>
      ) : null}
      <div className="mock-screen__body">{children}</div>
    </section>
  );
}
