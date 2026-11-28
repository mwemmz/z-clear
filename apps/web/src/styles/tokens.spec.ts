import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const baseCss = readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8');
const componentsCss = readFileSync(resolve(process.cwd(), 'src/styles/components.css'), 'utf8');
const themes = ['light', 'dark', 'cocoa'] as const;

const SEMANTIC_TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'border',
  'border-strong',
  'text',
  'text-muted',
  'primary',
  'on-primary',
  'accent-fill',
  'on-accent-fill',
  'success',
  'warning',
  'danger',
  'info',
  'focus',
] as const;

function themeTokens(theme: (typeof themes)[number]): Record<string, string> {
  const start = css.indexOf(`[data-theme='${theme}']`);
  expect(start, `${theme} theme block is missing`).toBeGreaterThan(-1);
  const end = css.indexOf('\n}', start);
  const block = css.slice(start, end);
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name && value) result[name] = value.trim();
  }
  return result;
}

function required(tokens: Record<string, string>, name: string): string {
  const value = tokens[name];
  expect(value, `missing token --${name}`).toBeDefined();
  return value ?? '';
}

function luminance(hex: string): number {
  const channels = (hex.slice(1).match(/../g) ?? []).map((value) => parseInt(value, 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('semantic colour tokens', () => {
  it.each(themes)('%s defines every required token', (theme) => {
    const tokens = themeTokens(theme);
    for (const token of SEMANTIC_TOKENS) {
      expect(tokens[token], `${theme} is missing --${token}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(themes)('%s meets WCAG AA contrast on every required pair', (theme) => {
    const token = themeTokens(theme);
    const bg = required(token, 'bg');
    const surface = required(token, 'surface');
    expect(contrast(required(token, 'text'), bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(required(token, 'text-muted'), bg)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(required(token, 'on-primary'), required(token, 'primary')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(required(token, 'on-accent-fill'), required(token, 'accent-fill')),
    ).toBeGreaterThanOrEqual(4.5);
    for (const status of ['success', 'warning', 'danger', 'info'] as const) {
      expect(
        contrast(required(token, status), surface),
        `${theme} ${status}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(required(token, 'border-strong'), surface)).toBeGreaterThanOrEqual(3);
  });

  it('defines rest, hover, pressed, focus, disabled, loading and success states', () => {
    expect(baseCss).toMatch(/button:hover:not\(:disabled\)/);
    expect(baseCss).toMatch(/button:active:not\(:disabled\)/);
    expect(baseCss).toMatch(/button:focus-visible/);
    expect(baseCss).toMatch(/button:disabled/);
    expect(baseCss).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(componentsCss).toMatch(/\.zc-button\[data-loading\]/);
    expect(componentsCss).toMatch(/\.zc-button\[data-success\]/);
    expect(baseCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('keeps raw colour values inside the token file', () => {
    const styleDir = resolve(process.cwd(), 'src/styles');
    const files = readdirSync(styleDir)
      .filter((file) => file.endsWith('.css') && file !== 'tokens.css')
      .map((file) => resolve(styleDir, file));
    const indexCss = resolve(process.cwd(), 'src/index.css');
    for (const file of [...files, indexCss]) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} contains a raw colour`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });
});
