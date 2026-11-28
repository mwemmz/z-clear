import { Cards, House, Plus, UserCircle, UsersThree } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from '@zclear/shared';
import { Button, StageTrack, StatePanel, StatusPill, type StateVariant } from '../ui';

export interface RecentCase {
  id: string;
  reference: string;
  stage: ShipmentStatus;
}

export type ImporterView = 'home' | 'agents' | 'profile';

interface Props {
  reference: string;
  clientName: string;
  stage: ShipmentStatus;
  updatedLabel?: string;
  actionText: string;
  recentCases: RecentCase[];
  onOpenCase: () => void;
  onSelectCase: (id: string) => void;
  onNewCase: () => void;
  onAgents: () => void;
  onProfile: () => void;
  view?: ImporterView;
  onHome?: () => void;
  state?: StateVariant;
  children?: ReactNode;
}

/** Importer console: one case, one dominant action, and a quiet case index. */
export function ImporterHome({
  reference,
  clientName,
  stage,
  updatedLabel,
  actionText,
  recentCases,
  onOpenCase,
  onSelectCase,
  onNewCase,
  onAgents,
  onProfile,
  view = 'home',
  onHome,
  state,
  children,
}: Props) {
  if (state) {
    return (
      <section className="home" data-testid="importer-home" aria-label="Importer home">
        <StatePanel variant={state} />
      </section>
    );
  }

  return (
    <section className="home" data-testid="importer-home" aria-label="Importer home">
      <div className="home__content">
        <div className="home__greeting">
          <div>
            <h2>Your case today</h2>
            <p>One case file. Every stage change is a manual record, not a ZRA status feed.</p>
          </div>
          <StatusPill tone={stage === 'on_hold' ? 'warning' : 'info'}>
            {SHIPMENT_STATUS_LABELS[stage]}
          </StatusPill>
        </div>

        <article className="card card--current current-case home__current">
          <div className="current-case__header">
            <div>
              <span className="eyebrow">Current case</span>
              <span className="current-case__id">{reference}</span>
            </div>
            <StatusPill tone={stage === 'on_hold' ? 'warning' : 'neutral'}>
              Manual record
            </StatusPill>
          </div>
          <p className="current-case__client">{clientName}</p>
          <StageTrack stage={stage} updatedLabel={updatedLabel} />
          <div className="case-facts">
            <div>
              <span>Stage source</span>
              <strong>Manual record</strong>
            </div>
            <div>
              <span>Last update</span>
              <strong>{updatedLabel ?? 'Not recorded'}</strong>
            </div>
            <div>
              <span>Customs system</span>
              <strong>ASYCUDA World</strong>
            </div>
          </div>
          <div className="current-case__footer">
            <span className="provenance">Nothing here is submitted to ZRA by this app.</span>
            <Button variant="primary" onClick={onOpenCase}>
              Open case
            </Button>
          </div>
        </article>

        <section className="action-strip home__action" aria-label="Action needed">
          <span className="action-strip__label">Next action</span>
          <div className="action-strip__text">
            <strong>Action needed</strong>
            <span>{actionText}</span>
          </div>
          <p className="provenance">Check the case file before acting. No live ZRA feed.</p>
        </section>

        {children}

        <section className="home__recent" aria-labelledby="recent-cases-heading">
          <h2 id="recent-cases-heading">Recent cases</h2>
          {recentCases.length === 0 ? (
            <p className="empty">No older cases yet. Your new case will appear here.</p>
          ) : (
            <ul className="recent-cases">
              {recentCases.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onSelectCase(item.id)}>
                    <span className="recent-cases__ref">{item.reference}</span>
                    <span className="recent-cases__meta">{SHIPMENT_STATUS_LABELS[item.stage]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <nav className="bottom-nav" aria-label="Importer navigation">
        <button
          type="button"
          className="bottom-nav__item"
          aria-current={view === 'home' ? 'page' : undefined}
          onClick={onHome}
        >
          <House size={24} weight={view === 'home' ? 'fill' : undefined} aria-hidden="true" />
          Home
        </button>
        <button type="button" className="bottom-nav__item" onClick={onOpenCase}>
          <Cards size={24} aria-hidden="true" />
          Cases
        </button>
        <Button variant="nav-new" className="bottom-nav__item--new" onClick={onNewCase}>
          <Plus size={24} weight="bold" aria-hidden="true" />
          <span className="sr-only">New case</span>
        </Button>
        <button
          type="button"
          className="bottom-nav__item"
          aria-current={view === 'agents' ? 'page' : undefined}
          onClick={onAgents}
        >
          <UsersThree size={24} aria-hidden="true" />
          Agents
        </button>
        <button
          type="button"
          className="bottom-nav__item"
          aria-current={view === 'profile' ? 'page' : undefined}
          onClick={onProfile}
        >
          <UserCircle size={24} aria-hidden="true" />
          Profile
        </button>
      </nav>
    </section>
  );
}
