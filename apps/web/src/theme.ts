/** Theme storage and application. Storage is best-effort on privacy-mode phones. */
export const THEMES = ['light', 'dark', 'cocoa'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'zclear-theme';
export const THEME_CHANGE_EVENT = 'zclear-theme-change';

const THEME_SET: ReadonlySet<string> = new Set(THEMES);

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEME_SET.has(value);
}

export function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function initialTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/** Applies the theme before React paints and persists it without throwing. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme still applies for this session when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: theme }));
}
