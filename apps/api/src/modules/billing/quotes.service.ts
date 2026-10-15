import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import { toQuoteDetail, toQuoteSummary } from './billing.mappers';
import { loadBillingConfig, priceValidatedLines } from './billing.pricing';
import type {
  CreateQuoteInput,
  QuoteDetail,
  QuoteStatusInput,
  QuoteSummary,
  UpdateQuoteInput,
} from './billing.dto';

const UNIQUE_VIOLATION = '23505';

const QUOTE_COLUMNS = [
  'id',
  'shipment_id',
  'reference',
  'currency',
  'status',
  'valid_until',
  'notes',
  'vat_rate_bp',
  'vat_verification_status',
  'subtotal_minor',
  'tax_minor',
  'total_minor',
  'created_at',
  'updated_at',
] as const;

const QUOTE_LINE_COLUMNS = [
  'id',
  'charge_type_code',
  'description',
  'quantity',
  'unit_amount_minor',
  'line_amount_minor',
  'is_taxable',
  'tax_minor',
  'sort_order',
] as const;

export { QUOTE_LINE_COLUMNS };

/** Legal status transitions for a quote. Accepted/declined/expired are final. */
const QUOTE_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['sent', 'accepted', 'declined', 'expired'],
  sent: ['accepted', 'declined', 'expired'],
  accepted: [],
  declined: [],
  expired: [],
};

@Injectable()
export class QuotesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async listForShipment(tenantId: string, shipmentId: string): Promise<QuoteSummary[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      await this.assertShipment(trx, shipmentId);
      const rows = await trx
        .selectFrom('quotes')
        .select(QUOTE_COLUMNS)
        .where('shipment_id', '=', shipmentId)
        .orderBy('created_at', 'desc')
        .execute();
      return rows.map(toQuoteSummary);
    });
  }

  async get(tenantId: string, id: string): Promise<QuoteDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const row = await trx
        .selectFrom('quotes')
        .select(QUOTE_COLUMNS)
        .where('id', '=', id)
        .executeTakeFirst();
      if (!row) throw ApiError.notFound('Quote not found');
      const lines = await this.linesOf(trx, id);
      return toQuoteDetail(row, lines);
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    shipmentId: string,
    input: CreateQuoteInput,
    meta: RequestMeta,
  ): Promise<QuoteDetail> {
    try {
      return await this.db.withTenant(tenantId, async (trx) => {
        await this.assertShipment(trx, shipmentId);
        const config = await loadBillingConfig(trx);
        const totals = await priceValidatedLines(trx, input.lines, config);

        const quoteId = uuidv7();
        const row = await trx
          .insertInto('quotes')
          .values({
            id: quoteId,
            tenant_id: tenantId,
            shipment_id: shipmentId,
            reference: input.reference,
            currency: input.currency,
            valid_until: asDate(input.validUntil),
            notes: input.notes ?? null,
            vat_rate_bp: config.vatRateBp,
            vat_verification_status: config.vatVerificationStatus,
            subtotal_minor: totals.subtotalMinor,
            tax_minor: totals.taxMinor,
            total_minor: totals.totalMinor,
            created_by: actorUserId,
            updated_by: actorUserId,
          })
          .returning(QUOTE_COLUMNS)
          .executeTakeFirstOrThrow();

        await this.insertLines(trx, tenantId, quoteId, totals.lines);
        await this.auditRecord(
          trx,
          tenantId,
          actorUserId,
          'quote.created',
          quoteId,
          {
            reference: input.reference,
            totalMinor: totals.totalMinor,
          },
          meta,
        );

        const lines = await this.linesOf(trx, quoteId);
        return toQuoteDetail(row, lines);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict('A quote with that reference already exists');
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: UpdateQuoteInput,
    meta: RequestMeta,
  ): Promise<QuoteDetail> {
    try {
      return await this.db.withTenant(tenantId, async (trx) => {
        const current = await trx
          .selectFrom('quotes')
          .select(['id', 'status', 'currency'])
          .where('id', '=', id)
          .executeTakeFirst();
        if (!current) throw ApiError.notFound('Quote not found');
        if (current.status !== 'draft') {
          throw ApiError.conflict('Only a draft quote can be edited');
        }

        const config = await loadBillingConfig(trx);
        const pricing = input.lines ? await priceValidatedLines(trx, input.lines, config) : null;

        const row = await trx
          .updateTable('quotes')
          .set({
            ...(input.reference !== undefined ? { reference: input.reference } : {}),
            ...(input.currency !== undefined ? { currency: input.currency } : {}),
            ...(input.validUntil !== undefined ? { valid_until: asDate(input.validUntil) } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(pricing
              ? {
                  subtotal_minor: pricing.subtotalMinor,
                  tax_minor: pricing.taxMinor,
                  total_minor: pricing.totalMinor,
                  vat_rate_bp: config.vatRateBp,
                  vat_verification_status: config.vatVerificationStatus,
                }
              : {}),
            updated_by: actorUserId,
            updated_at: new Date(),
          })
          .where('id', '=', id)
          .returning(QUOTE_COLUMNS)
          .executeTakeFirstOrThrow();

        if (pricing) {
          await trx.deleteFrom('quote_lines').where('quote_id', '=', id).execute();
          await this.insertLines(trx, tenantId, id, pricing.lines);
        }

        await this.auditRecord(
          trx,
          tenantId,
          actorUserId,
          'quote.updated',
          id,
          {
            fields: Object.keys(input),
          },
          meta,
        );

        const lines = await this.linesOf(trx, id);
        return toQuoteDetail(row, lines);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict('A quote with that reference already exists');
      }
      throw error;
    }
  }

  async setStatus(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: QuoteStatusInput,
    meta: RequestMeta,
  ): Promise<QuoteDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const current = await trx
        .selectFrom('quotes')
        .select(['id', 'status'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!current) throw ApiError.notFound('Quote not found');

      const allowed = QUOTE_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw ApiError.conflict(`A ${current.status} quote cannot move to ${input.status}`);
      }

      const row = await trx
        .updateTable('quotes')
        .set({ status: input.status, updated_by: actorUserId, updated_at: new Date() })
        .where('id', '=', id)
        .returning(QUOTE_COLUMNS)
        .executeTakeFirstOrThrow();

      await this.auditRecord(
        trx,
        tenantId,
        actorUserId,
        'quote.status_changed',
        id,
        {
          from: current.status,
          to: input.status,
        },
        meta,
      );

      const lines = await this.linesOf(trx, id);
      return toQuoteDetail(row, lines);
    });
  }

  private async assertShipment(trx: Transaction<Database>, shipmentId: string): Promise<void> {
    const shipment = await trx
      .selectFrom('shipments')
      .select('id')
      .where('id', '=', shipmentId)
      .executeTakeFirst();
    if (!shipment) throw ApiError.notFound('Shipment not found');
  }

  private async linesOf(trx: Transaction<Database>, quoteId: string) {
    return trx
      .selectFrom('quote_lines')
      .select(QUOTE_LINE_COLUMNS)
      .where('quote_id', '=', quoteId)
      .orderBy('sort_order', 'asc')
      .execute();
  }

  private async insertLines(
    trx: Transaction<Database>,
    tenantId: string,
    quoteId: string,
    lines: {
      chargeType: string;
      description: string;
      quantity: number;
      unitAmountMinor: number;
      lineAmountMinor: number;
      isTaxable: boolean;
      taxMinor: number;
    }[],
  ): Promise<void> {
    if (lines.length === 0) return;
    await trx
      .insertInto('quote_lines')
      .values(
        lines.map((line, index) => ({
          id: uuidv7(),
          tenant_id: tenantId,
          quote_id: quoteId,
          charge_type_code: line.chargeType,
          description: line.description,
          quantity: line.quantity,
          unit_amount_minor: line.unitAmountMinor,
          line_amount_minor: line.lineAmountMinor,
          is_taxable: line.isTaxable,
          tax_minor: line.taxMinor,
          sort_order: index,
        })),
      )
      .execute();
  }

  private auditRecord(
    trx: Transaction<Database>,
    tenantId: string,
    actorUserId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
    meta: RequestMeta,
  ) {
    return this.audit.recordInTransaction(trx, {
      tenantId,
      actorUserId,
      action,
      entityType: 'quote',
      entityId,
      metadata,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}

/** Convert an ISO date string to what the `date` column expects. */
export function asDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value as unknown as Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}
