import { Cards } from '@phosphor-icons/react';
import { IconRoute, IconTruckDelivery } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { SHIPMENT_STATUS_LABELS, stageProgress, type ShipmentStatus } from '@zclear/shared';
import { StatePanel, ThemeSwitcher, type StateVariant } from '../ui';

interface Props {
  cases: Array<{ id: string; reference: string; stage: ShipmentStatus }>;
  activeId: string | null;
  onSelect: (id: string) => void;
  state?: StateVariant;
  children: ReactNode;
}

/** Agent console: a stable queue, one selected case, and a provenance rail. */
export function AgentWorkspace({ cases, activeId, onSelect, state, children }: Props) {
  if (state) {
    return (
      <div className="agent-workspace" data-testid="agent-workspace">
        <StatePanel variant={state} />
      </div>
    );
  }

  return (
    <div className="agent-workspace" data-testid="agent-workspace">
      <aside className="agent-workspace__sidebar" aria-label="Agent navigation">
        <div className="agent-workspace__brand">
          <strong>Case console</strong>
          <span className="badge">Staff</span>
        </div>
        <nav className="agent-workspace__nav" aria-label="Workspace sections">
          <button type="button" aria-current="page">
            <Cards size={20} aria-hidden="true" /> Cases
          </button>
        </nav>
        <div className="agent-logistics" aria-label="Workflow scope">
          <span>
            <IconTruckDelivery size={20} stroke={1.5} aria-hidden="true" /> Check-ins
          </span>
          <span>
            <IconRoute size={20} stroke={1.5} aria-hidden="true" /> Route notes
          </span>
        </div>
        <p className="workspace-boundary">
          Stages are manual records. Customs assessment and release stay in ASYCUDA World.
        </p>
        <ThemeSwitcher compact />
      </aside>

      <section className="agent-workspace__list" aria-label="Case queue">
        <h2>Case queue</h2>
        {cases.length === 0 ? (
          <p className="empty">No cases are assigned to this account.</p>
        ) : (
          cases.map((item) => {
            const ratio = Math.max(stageProgress(item.stage), 0) / 6;
            return (
              <button
                key={item.id}
                type="button"
                className="mini-case"
                aria-current={item.id === activeId ? 'true' : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span>
                  <span className="mini-case__ref">{item.reference}</span>
                  <span className="recent-cases__meta">{SHIPMENT_STATUS_LABELS[item.stage]}</span>
                  <span
                    className="mini-case__bar"
                    style={{ '--mini-ratio': ratio } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                </span>
              </button>
            );
          })
        )}
      </section>

      <section className="agent-workspace__detail" aria-label="Case detail">
        {children}
      </section>
    </div>
  );
}
