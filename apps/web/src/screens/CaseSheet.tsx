import { X } from '@phosphor-icons/react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { ShipmentStatus } from '@zclear/shared';
import { Button, StageTrack, StatePanel, type StateVariant } from '../ui';

type Tab = 'Info' | 'Documents' | 'Review' | 'Payments';

const TABS = ['Info', 'Documents', 'Review', 'Payments'] as const;
const EXIT_MS = 120;

const TAB_NOTES: Record<Exclude<Tab, 'Info'>, string> = {
  Documents:
    'Document readiness is not included in this case feed. Check the checklist in the case file.',
  Review:
    'Review questions and recorded answers are in the case file. No live draft is shown here.',
  Payments: 'Invoices and off-platform payment records are in the case file below.',
};

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
  const closeTimer = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<Tab>('Info');
  const ratio = documentsTotal === 0 ? 0 : documentsReady / documentsTotal;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom still lacks dialog.showModal; the open attribute keeps tests and
      // older browsers usable while the native modal path stays the default.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      return;
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      setClosing(false);
    }
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, [open]);

  function requestClose(): void {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      setClosing(false);
      closeTimer.current = null;
      onClose();
    }, EXIT_MS);
  }

  function selectTab(index: number): void {
    const nextTab: Tab = TABS[index] ?? 'Info';
    setTab(nextTab);
    document.getElementById(`case-tab-${nextTab}`)?.focus();
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectTab(next);
  }

  return (
    <dialog
      ref={dialogRef}
      className="case-sheet"
      data-closing={closing || undefined}
      aria-labelledby="case-sheet-label case-sheet-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div className="sheet__grip" aria-hidden="true" />
      <header className="sheet__header">
        <div>
          <span className="eyebrow">Case file</span>
          <span className="sr-only" id="case-sheet-label">
            Case details
          </span>
          <strong className="current-case__id" id="case-sheet-title">
            {reference}
          </strong>
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
            role="img"
            aria-label={
              documentsTotal === 0
                ? 'Document count not available'
                : `${documentsReady} of ${documentsTotal} documents ready`
            }
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
          {TABS.map((name, index) => (
            <button
              key={name}
              id={`case-tab-${name}`}
              type="button"
              role="tab"
              className="tabs__tab"
              aria-controls={tab === name ? 'case-panel-current' : undefined}
              aria-selected={tab === name}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={(event) => handleTabKey(event, index)}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          id="case-panel-current"
          className="tab-panel"
          role="tabpanel"
          aria-labelledby={`case-tab-${tab}`}
          tabIndex={0}
        >
          {state ? (
            <StatePanel variant={state} />
          ) : tab === 'Info' ? (
            children
          ) : (
            <p className="tab-note">{TAB_NOTES[tab]}</p>
          )}
        </div>

        <p className="provenance">
          Manual stage record. Customs data and filing remain in ASYCUDA World.
        </p>
      </div>
    </dialog>
  );
}
