import {
  ClockClockwise,
  FileDashed,
  LockKey,
  WarningCircle,
  WifiSlash,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export type StateVariant = 'loading' | 'empty' | 'error' | 'denied' | 'stale';

interface Props {
  variant: StateVariant;
  title?: string;
  message?: string;
  action?: ReactNode;
}

const CONTENT: Record<StateVariant, { icon: typeof FileDashed; title: string; message: string }> = {
  loading: {
    icon: ClockClockwise,
    title: 'Getting your case ready',
    message: 'This is taking a moment. Your details are safe.',
  },
  empty: {
    icon: FileDashed,
    title: 'Nothing here yet',
    message: 'Add a case or ask your agent to send the next step.',
  },
  error: {
    icon: WifiSlash,
    title: 'Could not load this',
    message: 'Check your connection and try again. Nothing was changed.',
  },
  denied: {
    icon: LockKey,
    title: 'You cannot open this case',
    message: 'Your role does not have access. Ask your agency for help.',
  },
  stale: {
    icon: WarningCircle,
    title: 'A newer draft is available',
    message: 'Refresh before you approve so you see the latest details.',
  },
};

/** One place for loading, empty, error, denied and stale-draft microcopy. */
export function StatePanel({ variant, title, message, action }: Props) {
  const content = CONTENT[variant];
  const Icon = content.icon;
  return (
    <div
      className={`state-panel state-panel--${variant}`}
      role={variant === 'error' ? 'alert' : undefined}
    >
      {variant === 'loading' ? (
        <span className="state-panel__skeleton" aria-hidden="true" />
      ) : (
        <Icon size={24} aria-hidden="true" />
      )}
      <strong>{title ?? content.title}</strong>
      <p>{message ?? content.message}</p>
      {action}
    </div>
  );
}
