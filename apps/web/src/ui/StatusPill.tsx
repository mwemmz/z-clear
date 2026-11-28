import { CheckCircle, Circle, Info, WarningCircle, XCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Props {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

const ICONS = {
  success: CheckCircle,
  warning: WarningCircle,
  danger: XCircle,
  info: Info,
  neutral: Circle,
} as const;

/** Status is always icon + text, never colour alone. */
export function StatusPill({ tone, children, className = '' }: Props) {
  const Icon = ICONS[tone];
  return (
    <span className={`status-pill status-pill--${tone}${className ? ` ${className}` : ''}`}>
      <Icon size={16} aria-hidden="true" />
      {children}
    </span>
  );
}
