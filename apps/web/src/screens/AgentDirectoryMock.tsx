import { Clock, Package, UsersThree } from '@phosphor-icons/react';
import { useState } from 'react';
import { MockScreen } from '../mockups/MockScreen';
import { Button, StatePanel, type StateVariant } from '../ui';

const AGENTS = [
  { name: 'Chanda Clearing', area: 'Ndola', points: 42, shipments: 18, fixTime: '~2h' },
  { name: 'Copperbelt Clearing', area: 'Kitwe', points: 37, shipments: 24, fixTime: '~3h' },
  { name: 'Lusaka Desk', area: 'Lusaka', points: 51, shipments: 31, fixTime: '~1h' },
] as const;

const FILTERS = ['All', 'Nearby', 'Fast queries'] as const;

interface Props {
  state?: StateVariant;
}

/** Mock directory: every metric is sample data, never a claim about a real firm. */
export function AgentDirectoryMock({ state }: Props = {}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  if (state) {
    return (
      <MockScreen
        label="Agent directory (mock)"
        note="Sample agents, points and timings. No live directory lookup."
      >
        <StatePanel variant={state} />
      </MockScreen>
    );
  }

  const visible = AGENTS.filter((agent) => {
    if (filter === 'Nearby') return agent.area === 'Ndola';
    if (filter === 'Fast queries') return agent.fixTime === '~1h';
    return true;
  });

  return (
    <MockScreen
      label="Agent directory (mock)"
      note="Sample agents, points and timings. No live directory lookup."
    >
      <div className="filter-chips" aria-label="Filter agents">
        {FILTERS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={filter === name}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="agent-cards">
        {visible.map((agent) => (
          <article key={agent.name} className="agent-card">
            <div className="current-case__header">
              <strong>{agent.name}</strong>
              <span className="recent-cases__meta">{agent.area}</span>
            </div>
            <div className="agent-card__facts">
              <span>
                <UsersThree size={16} aria-hidden="true" /> {agent.points} points
              </span>
              <span>
                <Package size={16} aria-hidden="true" /> {agent.shipments} shipments
              </span>
              <span>
                <Clock size={16} aria-hidden="true" /> Queries fixed in {agent.fixTime}
              </span>
            </div>
            <div className="agent-card__actions">
              <Button onClick={() => undefined} aria-label={`Choose ${agent.name} (mock)`}>
                Choose (mock)
              </Button>
            </div>
          </article>
        ))}
      </div>
      <p className="mock-hint">Sample, not ZRA figures. Choosing here changes nothing.</p>
    </MockScreen>
  );
}
