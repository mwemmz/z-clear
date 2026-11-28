import { Cards, House, List } from '@phosphor-icons/react';
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

/** Agent layout: navigation, a compact queue and the case detail pane. */
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
        <strong>Z Clear</strong>
        <nav className="agent-workspace__nav">
          <button type="button" aria-current="page">
            <House size={20} aria-hidden="true" /> Home
          </button>
          <button type="button">
            <Cards size={20} aria-hidden="true" /> Cases
          </button>
          <button type="button">
            <IconTruckDelivery size={20} stroke={1.5} aria-hidden="true" /> Drivers
          </button>
          <button type="button">
            <IconRoute size={20} stroke={1.5} aria-hidden="true" /> Routes
          </button>
          <button type="button">
            <List size={20} aria-hidden="true" /> Mocks
          </button>
        </nav>
        <ThemeSwitcher compact />
      </aside>

      <section className="agent-workspace__list" aria-label="Case queue">
        <h2>Case queue</h2>
        {cases.map((item) => {
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
        })}
      </section>

      <section className="agent-workspace__detail" aria-label="Case detail">
        {children}
      </section>
    </div>
  );
}
