import { describe, expect, it } from 'vitest';
import { formatDateOnly } from './dates';

describe('formatDateOnly', () => {
  it('keeps the calendar day of a local-midnight date', () => {
    // Constructed the same way node-postgres parses a Postgres `date`.
    expect(formatDateOnly(new Date(2026, 10, 1))).toBe('2026-11-01');
    expect(formatDateOnly(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});
