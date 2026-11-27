import { caseConsignmentSchema } from './importer-case';
import { CURRENCIES, formatMoney, type CurrencyCode } from './money';

/**
 * The value shown to an importer is a value they entered on their own case. It
 * is NOT a customs valuation, duty, VAT or fee calculation. Z Clear never
 * decides customs value; that happens in ASYCUDA World.
 */
export const VALUATION_NOTICE =
  'This is the value recorded on your case, not a customs assessment. Z Clear does not decide customs value, assess duty or tax, or send anything to ZRA. Customs value is decided in ASYCUDA World.';

export interface RecordedValuation {
  label: string;
  description: string;
  amountMinor: number;
  currency: string;
  formatted: string;
}

function format(amountMinor: number, currency: string): string {
  if (CURRENCIES.includes(currency as CurrencyCode)) {
    return formatMoney({ amountMinor, currency: currency as CurrencyCode });
  }
  // The typed case schema permits any three-letter code; never crash the UI
  // when a non-supported currency was entered.
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

/** Reads a typed case's recorded value without validating or assessing it. */
export function recordedValuation(consignment: unknown): RecordedValuation | null {
  const parsed = caseConsignmentSchema.safeParse(consignment);
  if (!parsed.success) return null;

  if (parsed.data.caseKind === 'vehicle') {
    const vehicle = parsed.data.vehicle;
    return {
      label: 'Purchase price you recorded',
      description: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
      amountMinor: vehicle.purchasePriceMinor,
      currency: vehicle.currency,
      formatted: format(vehicle.purchasePriceMinor, vehicle.currency),
    };
  }

  const goods = parsed.data.goods;
  return {
    label: 'Value you recorded',
    description: goods.description,
    amountMinor: goods.valueMinor,
    currency: goods.currency,
    formatted: format(goods.valueMinor, goods.currency),
  };
}
