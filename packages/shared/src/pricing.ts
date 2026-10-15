/**
 * One line as entered by staff. `isTaxable` is not client-supplied: it is
 * derived from the charge type's configuration before pricing.
 */
export interface PriceLineInput {
  chargeType: string;
  description: string;
  /** Whole units, at least 1. Fractions are out of scope for this phase. */
  quantity: number;
  /** Unit price in integer minor units (never a float). */
  unitAmountMinor: number;
  isTaxable: boolean;
}

export interface PricedLine extends PriceLineInput {
  lineAmountMinor: number;
  taxMinor: number;
}

export interface PriceTotals {
  lines: PricedLine[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

/**
 * Tax on an integer minor-unit amount, rounded half away from zero. Kept as a
 * pure integer function so money never passes through a float.
 */
export function taxOnAmount(amountMinor: number, rateBp: number): number {
  if (!Number.isInteger(amountMinor) || !Number.isInteger(rateBp)) {
    throw new Error('amountMinor and rateBp must be integers');
  }
  return Math.round((amountMinor * rateBp) / 10_000);
}

/**
 * Prices a set of lines and totals them. VAT is applied only to taxable lines
 * (the service fee); pass-through lines are summed untouched. All arithmetic is
 * on integer minor units.
 */
export function priceLines(lines: readonly PriceLineInput[], vatRateBp: number): PriceTotals {
  const priced: PricedLine[] = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error('quantity must be an integer of at least 1');
    }
    if (!Number.isInteger(line.unitAmountMinor) || line.unitAmountMinor < 0) {
      throw new Error('unitAmountMinor must be a non-negative integer');
    }
    const lineAmountMinor = line.unitAmountMinor * line.quantity;
    const taxMinor = line.isTaxable ? taxOnAmount(lineAmountMinor, vatRateBp) : 0;
    return { ...line, lineAmountMinor, taxMinor };
  });

  const subtotalMinor = priced.reduce((sum, line) => sum + line.lineAmountMinor, 0);
  const taxMinor = priced.reduce((sum, line) => sum + line.taxMinor, 0);
  return { lines: priced, subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

/**
 * Whether money in `totalMinor` is covered by `paidMinor`. Overpayment is
 * allowed but never makes the balance negative below zero.
 */
export function outstandingMinor(totalMinor: number, paidMinor: number): number {
  return Math.max(0, totalMinor - paidMinor);
}

export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

/** Derives the payment state of an issued invoice from what has been paid. */
export function paymentStatusFor(totalMinor: number, paidMinor: number): InvoicePaymentStatus {
  if (paidMinor <= 0) return 'unpaid';
  if (paidMinor >= totalMinor) return 'paid';
  return 'partially_paid';
}
