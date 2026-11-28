import { CaretRight, House, Plus, UserCircle, UsersThree, Cards } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from '@zclear/shared';
import { Button, StageTrack, StatePanel, StatusPill, type StateVariant } from '../ui';

export interface RecentCase {
  reference: string;
  stage: ShipmentStatus;
}

interface Props {
  reference: string;
  clientName: string;
  stage: ShipmentStatus;
  updatedLabel?: string;
  actionText: string;
  recentCases: RecentCase[];
  onOpenCase: () => void;
  onNewCase: () => void;
  onAgents: () => void;
  onProfile: () => void;
  state?: StateVariant;
  children?: ReactNode;
}

/** Importer phone home: one current case, one action, then quiet history. */
export function ImporterHome({
  reference,
  clientName,
  stage,
  updatedLabel,
  actionText,
  recentCases,
  onOpenCase,
  onNewCase,
  onAgents,
  onProfile,
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
      <div className="home__greeting">
        <div>
          <h2>Your case today</h2>
          <p>One place to see what your agent recorded.</p>
        </div>
        <StatusPill tone={stage === 'on_hold' ? 'warning' : 'info'}>
          {SHIPMENT_STATUS_LABELS[stage]}
        </StatusPill>
      </div>

      <article className="card card--current">
        <div className="current-case__header">
          <span className="current-case__id">{reference}</span>
          <span className="recent-cases__meta">{clientName}</span>
        </div>
        <StageTrack stage={stage} updatedLabel={updatedLabel} />
        <div className="current-case__footer">
          <span className="recent-cases__meta">Manual stage record · updates in ASYCUDA World</span>
          <Button variant="primary" onClick={onOpenCase}>
            Open case
          </Button>
        </div>
      </article>

      <section className="action-strip" aria-label="Action needed">
        <div className="action-strip__text">
          <strong>Action needed</strong>
          <span>{actionText}</span>
        </div>
        <Button onClick={onOpenCase}>Review</Button>
      </section>

      {children}

      <section aria-labelledby="recent-cases-heading">
        <h2 id="recent-cases-heading">Recent cases</h2>
        {recentCases.length === 0 ? (
          <p className="empty">No older cases yet. Your new case will appear here.</p>
        ) : (
          <ul className="recent-cases">
            {recentCases.map((item) => (
              <li key={item.reference}>
                <span className="recent-cases__ref">{item.reference}</span>
                <span className="recent-cases__meta">{SHIPMENT_STATUS_LABELS[item.stage]}</span>
                <CaretRight size={16} aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Importer navigation">
        <button type="button" className="bottom-nav__item" aria-current="page">
          <House size={24} weight="fill" aria-hidden="true" />
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
        <button type="button" className="bottom-nav__item" onClick={onAgents}>
          <UsersThree size={24} aria-hidden="true" />
          Agents
        </button>
        <button type="button" className="bottom-nav__item" onClick={onProfile}>
          <UserCircle size={24} aria-hidden="true" />
          Profile
        </button>
      </nav>
    </section>
  );
}
