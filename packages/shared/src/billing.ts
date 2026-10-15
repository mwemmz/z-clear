/**
 * Billing configuration that is business data, not code, but still needs a
 * stable identifier so a line can be validated and taxed consistently.
 *
 * The categories come from the owner's brief. `isServiceFee` marks the lines a
 * Zambian VAT applies to ("16% on the service fee only"); everything else is a
 * pass-through (duty, transport, port charges, disbursements). No rate or fee
 * *amount* lives here — amounts are entered per line by staff.
 */
export const CHARGE_TYPES = [
  { code: 'customs_duty', label: 'Customs duty', isServiceFee: false, sortOrder: 10 },
  { code: 'vat', label: 'VAT', isServiceFee: false, sortOrder: 20 },
  { code: 'agency_fee', label: 'Agency / clearance fee', isServiceFee: true, sortOrder: 30 },
  { code: 'transport', label: 'Transport / haulage', isServiceFee: false, sortOrder: 40 },
  { code: 'port_charges', label: 'Port / terminal / storage', isServiceFee: false, sortOrder: 50 },
  { code: 'disbursements', label: 'Disbursements / other', isServiceFee: false, sortOrder: 60 },
] as const;

export type ChargeTypeCode = (typeof CHARGE_TYPES)[number]['code'];

export const CHARGE_TYPE_CODES = CHARGE_TYPES.map(
  (chargeType) => chargeType.code,
) as ChargeTypeCode[];

export function isChargeTypeCode(value: string): value is ChargeTypeCode {
  return (CHARGE_TYPE_CODES as readonly string[]).includes(value);
}

export function chargeTypeByCode(code: string): (typeof CHARGE_TYPES)[number] | undefined {
  return CHARGE_TYPES.find((chargeType) => chargeType.code === code);
}

/**
 * A configured tax rate, stored in integer basis points (1600 = 16.00%). It is
 * intentionally not hard-coded: the row that carries it is flagged
 * NEEDS_VERIFICATION until confirmed against a current ZRA source.
 */
export const VAT_STANDARD_CODE = 'VAT_STANDARD';
