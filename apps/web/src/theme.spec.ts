import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initialTheme, isTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from './theme';

describe('theme', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('validates only the three supported themes', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('cocoa')).toBe(true);
    expect(isTheme('system')).toBe(false);
  });

  it('applies and remembers the chosen theme', () => {
    applyTheme('cocoa');
    expect(document.documentElement.getAttribute('data-theme')).toBe('cocoa');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('cocoa');
    expect(initialTheme()).toBe('cocoa');
  });

  it('notifies every switcher when the theme changes', () => {
    const listener = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, listener);
    applyTheme('dark');
    window.removeEventListener(THEME_CHANGE_EVENT, listener);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ detail: 'dark' });
  });

  it('still applies a theme when storage is blocked', () => {
    const original = window.localStorage.setItem;
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(() => applyTheme('dark')).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    window.localStorage.setItem = original;
    vi.restoreAllMocks();
  });
});
