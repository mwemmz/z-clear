import { Check, SpinnerGap } from '@phosphor-icons/react';
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'icon' | 'nav-new' | 'destructive' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Briefly morphs the label into a check, then returns to the label. */
  success?: boolean;
  iconOnly?: boolean;
  children: ReactNode;
}

/**
 * One button for the whole app. Rest, pointer-only hover, pressed, focus,
 * disabled, loading and success are handled with semantic tokens only.
 */
export function Button({
  variant = 'secondary',
  loading = false,
  success = false,
  iconOnly = false,
  className = '',
  children,
  disabled,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    setShowSuccess(true);
    const timer = window.setTimeout(() => setShowSuccess(false), 900);
    return () => window.clearTimeout(timer);
  }, [success]);

  return (
    <button
      {...rest}
      type={type}
      className={`zc-button zc-button--${variant}${iconOnly ? ' zc-button--icon' : ''}${
        className ? ` ${className}` : ''
      }`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      data-success={showSuccess || undefined}
      onClick={(event) => {
        if (loading) return;
        onClick?.(event);
      }}
    >
      {iconOnly ? children : <span className="zc-button__label">{children}</span>}
      {loading && <SpinnerGap className="zc-button__overlay" size={20} aria-hidden="true" />}
      {showSuccess && <Check className="zc-button__overlay" size={20} aria-hidden="true" />}
    </button>
  );
}
