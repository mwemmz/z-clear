import { ChatCircle, Phone, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ShipmentStatus } from '@zclear/shared';
import { Button, StageTrack, StatePanel, type StateVariant } from '../ui';

type Tab = 'Info' | 'Documents' | 'Review' | 'Payments';

interface Props {
  open: boolean;
  onClose: () => void;
  reference: string;
  route: string;
  stage: ShipmentStatus;
  documentsReady: number;
  documentsTotal: number;
  state?: StateVariant;
  children: ReactNode;
}

/** Native dialog used as a bottom sheet: accessible without a drawer dependency. */
export function CaseSheet({
  open,
  onClose,
  reference,
  route,
  stage,
  documentsReady,
  documentsTotal,
  state,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<Tab>('Info');
  const ratio = documentsTotal === 0 ? 0 : documentsReady / documentsTotal;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }
    if (!open && dialog.open) {
      setClosing(true);
      const timer = window.setTimeout(() => {
        dialog.close();
        setClosing(false);
      }, 140);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  function requestClose(): void {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 140);
  }

  return (
    <dialog
      ref={dialogRef}
      className="case-sheet"
      data-closing={closing || undefined}
      aria-labelledby="case-sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div className="sheet__grip" aria-hidden="true" />
      <header className="sheet__header">
        <div>
          <span className="sr-only" id="case-sheet-title">
            Case details
          </span>
          <strong className="current-case__id">{reference}</strong>
          <p className="recent-cases__meta">{route}</p>
        </div>
        <Button variant="icon" iconOnly aria-label="Close case details" onClick={requestClose}>
          <X size={20} aria-hidden="true" />
        </Button>
      </header>

      <div className="sheet__body">
        <StageTrack stage={stage} />
        <div className="readiness">
          <span
            className="readiness__ring"
            style={{ '--readiness': ratio } as CSSProperties}
            aria-label={`${documentsReady} of ${documentsTotal} documents ready`}
          >
            <span className="readiness__value">
              {documentsTotal === 0 ? '—' : `${documentsReady}/${documentsTotal}`}
            </span>
          </span>
          <div>
            <strong>Document readiness</strong>
            <p className="recent-cases__meta">
              {documentsTotal === 0
                ? 'Document counts are not in the case feed.'
                : 'Readiness from the case checklist.'}
            </p>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Case sections">
          {(['Info', 'Documents', 'Review', 'Payments'] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              className="tabs__tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={tab}>
          {state ? <StatePanel variant={state} /> : children}
        </div>

        <div className="sheet__actions">
          <Button onClick={() => undefined} aria-label="Call your agent">
            <Phone size={20} aria-hidden="true" /> Call agent
          </Button>
          <Button onClick={() => undefined} aria-label="Message your agent">
            <ChatCircle size={20} aria-hidden="true" /> Message agent
          </Button>
        </div>
      </div>
    </dialog>
  );
}
