import { z } from 'zod';

/**
 * Typed details an importer supplies when opening their own case, before an
 * agent is appointed. These are user-supplied facts, never assessed amounts:
 * no duty, VAT or fee is calculated here.
 */
const shortText = (max: number) => z.string().trim().min(1).max(max);
const currency = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/);
const minorAmount = z.number().int().nonnegative();

export const vehicleDetailsSchema = z
  .object({
    make: shortText(100),
    model: shortText(100),
    year: z.number().int().min(1900).max(2100),
    /** VIN or chassis number — at least one is required by the caller. */
    vinOrChassis: shortText(64),
    engine: shortText(100),
    /** User-declared purchase price in integer minor units. */
    purchasePriceMinor: minorAmount,
    currency: currency.default('ZMW'),
    origin: shortText(200),
    portOfEntry: shortText(200),
  })
  .strict();

export const goodsDetailsSchema = z
  .object({
    description: shortText(500),
    /** HS code supplied by the importer; not looked up or assessed by us. */
    hsCode: z
      .string()
      .trim()
      .regex(/^\d{4,10}$/)
      .optional(),
    quantity: z.number().int().positive(),
    unit: shortText(50),
    /** User-declared value in integer minor units. */
    valueMinor: minorAmount,
    currency: currency.default('ZMW'),
    origin: shortText(200),
    portOfEntry: shortText(200),
  })
  .strict();

export const caseConsignmentSchema = z.discriminatedUnion('caseKind', [
  z.object({ caseKind: z.literal('vehicle'), vehicle: vehicleDetailsSchema }).strict(),
  z.object({ caseKind: z.literal('goods'), goods: goodsDetailsSchema }).strict(),
]);

export type VehicleDetails = z.infer<typeof vehicleDetailsSchema>;
export type GoodsDetails = z.infer<typeof goodsDetailsSchema>;
export type CaseConsignment = z.infer<typeof caseConsignmentSchema>;
export type CaseKind = CaseConsignment['caseKind'];

/** Human-readable case kind for labels; never used for tax or compliance decisions. */
export function caseKindLabel(kind: CaseKind): string {
  return kind === 'vehicle' ? 'Vehicle' : 'Goods';
}
