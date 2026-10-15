import type { Transaction } from 'kysely';
import {
  priceLines,
  VAT_STANDARD_CODE,
  type PriceLineInput,
  type PriceTotals,
} from '@zclear/shared';
import { ApiError } from '../../common/errors/api-error';
import type { Database, VerificationStatus } from '../../database/database.types';
import type { LineInput } from './billing.dto';

export interface BillingConfig {
  vatRateBp: number;
  vatVerificationStatus: VerificationStatus;
  hasVatRate: boolean;
}

/**
 * Reads the configured VAT rate. The rate is data, not code: the row is seeded
 * flagged NEEDS_VERIFICATION and can be superseded without a deploy.
 */
export async function loadBillingConfig(trx: Transaction<Database>): Promise<BillingConfig> {
  const rate = await trx
    .selectFrom('tax_rates')
    .select(['rate_bp', 'verification_status'])
    .where('code', '=', VAT_STANDARD_CODE)
    .where('effective_to', 'is', null)
    .executeTakeFirst();
  return {
    vatRateBp: rate?.rate_bp ?? 0,
    vatVerificationStatus: rate?.verification_status ?? 'NEEDS_VERIFICATION',
    hasVatRate: Boolean(rate),
  };
}

/**
 * Validates each line's charge type against configuration, derives taxability
 * from it (never from client input — a client cannot mark a pass-through as
 * taxable, nor the reverse) and prices the set. Money stays in integer minor
 * units throughout.
 */
export async function priceValidatedLines(
  trx: Transaction<Database>,
  lines: readonly LineInput[],
  config: BillingConfig,
): Promise<PriceTotals> {
  const codes = [...new Set(lines.map((line) => line.chargeType))];
  const rows = await trx
    .selectFrom('charge_types')
    .select(['code', 'is_service_fee', 'is_selectable', 'is_active'])
    .where('code', 'in', codes)
    .execute();
  const byCode = new Map(rows.map((row) => [row.code, row]));

  const prepared: PriceLineInput[] = lines.map((line) => {
    const chargeType = byCode.get(line.chargeType);
    if (!chargeType || !chargeType.is_active) {
      throw ApiError.validation('Unknown charge type', [
        { field: 'chargeType', issue: `'${line.chargeType}' is not a configured charge type` },
      ]);
    }
    if (!chargeType.is_selectable) {
      throw ApiError.validation('That charge type is calculated automatically', [
        { field: 'chargeType', issue: `'${line.chargeType}' cannot be entered manually` },
      ]);
    }
    return {
      chargeType: line.chargeType,
      description: line.description,
      quantity: line.quantity,
      unitAmountMinor: line.unitAmountMinor,
      isTaxable: chargeType.is_service_fee,
    };
  });

  if (!config.hasVatRate && prepared.some((line) => line.isTaxable)) {
    throw ApiError.validation('No VAT rate is configured; set billing configuration first', [
      { field: 'lines', issue: 'a taxable line needs a configured VAT rate' },
    ]);
  }

  return priceLines(prepared, config.vatRateBp);
}
