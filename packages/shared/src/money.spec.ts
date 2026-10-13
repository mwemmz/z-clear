import { describe, expect, it } from 'vitest';
import { formatMoney, makeMoney, divideByMinorUnit } from './money';

describe('money', () => {
  it('rejects non-integer minor units', () => {
    expect(() => makeMoney(1.5, 'ZMW')).toThrow();
  });

  it('converts minor units to major units', () => {
    expect(divideByMinorUnit(makeMoney(15050, 'ZMW'))).toBe(150.5);
  });

  it('formats ZMW with two decimals and a currency marker', () => {
    const formatted = formatMoney(makeMoney(15050, 'ZMW'));
    expect(formatted).toMatch(/150\.50/);
    // Locale renders ZMW as the symbol "K" or the code "ZMW" depending on ICU data.
    expect(formatted).not.toBe('150.50');
  });

  it('formats USD with two decimals', () => {
    const formatted = formatMoney(makeMoney(100, 'USD'), 'en-US');
    expect(formatted).toContain('1.00');
    expect(formatted).toContain('$');
  });
});
