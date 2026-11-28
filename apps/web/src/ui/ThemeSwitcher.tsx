import { Coffee, Moon, Sun } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { applyTheme, initialTheme, isTheme, THEME_CHANGE_EVENT, type Theme } from '../theme';

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'cocoa', label: 'Cocoa Sky', icon: Coffee },
];

interface Props {
  compact?: boolean;
}

/** Three-option control used in the header menu and the profile section. */
export function ThemeSwitcher({ compact = false }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    // Header, profile and gallery controls stay in sync without a store.
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isTheme(detail)) setTheme(detail);
    };
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  return (
    <div
      className={`theme-switcher${compact ? ' theme-switcher--compact' : ''}`}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className="theme-switcher__option"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          <Icon size={compact ? 16 : 20} aria-hidden="true" />
          {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
