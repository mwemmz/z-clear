/** Currencies the platform handles. ZMW is the default; USD appears on quotes. */
export const CURRENCIES = ['ZMW', 'USD'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** ISO-4217 minor-unit exponents we support (both are 2 decimal places). */
const MINOR_UNIT_EXPONENT: Record<CurrencyCode, number> = {
  ZMW: 2,
  USD: 2,
};

/**
 * Money as integer minor units plus currency. Never use floats for money.
 * `15050` ZMW means 150.50 ZMW.
 */
export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export function makeMoney(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error('amountMinor must be an integer number of minor units');
  }
  return { amountMinor, currency };
}

export function divideByMinorUnit(money: Money): number {
  return money.amountMinor / 10 ** MINOR_UNIT_EXPONENT[money.currency];
}

export function formatMoney(money: Money, locale = 'en-ZM'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: MINOR_UNIT_EXPONENT[money.currency],
    maximumFractionDigits: MINOR_UNIT_EXPONENT[money.currency],
  }).format(divideByMinorUnit(money));
}
