import { Cards, Gift, House, UserCircle, UsersThree, X } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';
import { Button } from './ui';

export type AppView = 'home' | 'agents' | 'profile';

interface Props {
  navOpen: boolean;
  onCloseNav: () => void;
  onOpenLoyalty: () => void;
  role: string;
  view: AppView;
  onHome: () => void;
  onCases: () => void;
  onAgents: () => void;
  onProfile: () => void;
}

interface NavItem {
  label: string;
  icon: ReactNode;
  current: boolean;
  onSelect: () => void;
}

/**
 * One navigation model for the quiet desktop rail and the phone drawer. The
 * drawer is the only visible navigation on small screens; the rail replaces the
 * in-page rails so the case stays the first thing read.
 */
export function ShellChrome({
  navOpen,
  onCloseNav,
  onOpenLoyalty,
  role,
  view,
  onHome,
  onCases,
  onAgents,
  onProfile,
}: Props) {
  const items: NavItem[] = [
    {
      label: 'Home',
      icon: <House size={20} aria-hidden="true" />,
      current: view === 'home',
      onSelect: onHome,
    },
    {
      label: 'Cases',
      icon: <Cards size={20} aria-hidden="true" />,
      current: false,
      onSelect: onCases,
    },
    ...(role === 'client_viewer'
      ? [
          {
            label: 'Agents',
            icon: <UsersThree size={20} aria-hidden="true" />,
            current: view === 'agents',
            onSelect: onAgents,
          },
        ]
      : []),
    {
      label: 'Profile',
      icon: <UserCircle size={20} aria-hidden="true" />,
      current: view === 'profile',
      onSelect: onProfile,
    },
  ];

  useEffect(() => {
    if (!navOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseNav();
    };
    window.addEventListener('keydown', handleKey);
    document.querySelector<HTMLButtonElement>('.nav-drawer button')?.focus();
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.querySelector<HTMLButtonElement>('[data-testid="nav-toggle"]')?.focus();
    };
  }, [navOpen, onCloseNav]);

  function renderNav(onSelectItem: (item: NavItem) => void): ReactNode {
    return (
      <>
        <nav className="app-rail__nav" aria-label="Workspace sections">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-current={item.current ? 'page' : undefined}
              onClick={() => onSelectItem(item)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="app-rail__footer">
          <Button variant="ghost" className="app-rail__loyalty" onClick={onOpenLoyalty}>
            <Gift size={20} aria-hidden="true" />
            Points & referrals
          </Button>
          <p className="app-rail__note">Structure only · no verified rules yet</p>
        </div>
      </>
    );
  }

  return (
    <>
      <aside
        className="app-rail"
        data-testid="app-rail"
        aria-label="Primary navigation"
        aria-hidden={navOpen || undefined}
      >
        <div className="app-rail__brand">
          <span className="app-mark" aria-hidden="true">
            Z
          </span>
          <div>
            <strong>Case console</strong>
            <span>Manual workflow</span>
          </div>
        </div>
        {renderNav((item) => item.onSelect())}
      </aside>

      {navOpen && (
        <>
          <div className="nav-drawer__scrim" onClick={onCloseNav} aria-hidden="true" />
          <aside className="nav-drawer" data-testid="nav-drawer" aria-label="Mobile navigation">
            <header className="nav-drawer__header">
              <div>
                <span className="eyebrow">Navigation</span>
                <strong>Menu</strong>
              </div>
              <Button variant="icon" iconOnly aria-label="Close navigation" onClick={onCloseNav}>
                <X size={20} aria-hidden="true" />
              </Button>
            </header>
            {renderNav((item) => {
              item.onSelect();
              onCloseNav();
            })}
          </aside>
        </>
      )}
    </>
  );
}
