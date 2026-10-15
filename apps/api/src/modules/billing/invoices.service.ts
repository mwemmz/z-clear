import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import { paymentStatusFor } from '@zclear/shared';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import { toInvoiceDetail, toPaymentSummary, type PaymentRow } from './billing.mappers';
import { loadBillingConfig, priceValidatedLines } from './billing.pricing';
import type {
  CreateInvoiceInput,
  InvoiceDetail,
  ListInvoicesQuery,
  RecordPaymentInput,
  UpdateInvoiceInput,
  VoidInvoiceInput,
} from './billing.dto';
import { asDate, QUOTE_LINE_COLUMNS } from './quotes.service';

const INVOICE_COLUMNS = [
  'id',
  'shipment_id',
  'quote_id',
  'number',
  'currency',
  'status',
  'issue_date',
  'due_date',
  'notes',
  'exchange_rate',
  'vat_rate_bp',
  'vat_verification_status',
  'subtotal_minor',
  'tax_minor',
  'total_minor',
  'amount_paid_minor',
  'issued_at',
  'voided_at',
  'void_reason',
  'created_at',
  'updated_at',
] as const;

const INVOICE_LINE_COLUMNS = [
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

const PAYMENT_COLUMNS = [
  'id',
  'amount_minor',
  'currency',
  'method',
  'reference',
  'paid_on',
  'note',
  'recorded_by',
  'created_at',
] as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ListInvoicesQuery): Promise<InvoiceDetail[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      let builder = trx.selectFrom('invoices').select(INVOICE_COLUMNS);
      if (query.status) builder = builder.where('status', '=', query.status);
      if (query.shipmentId) builder = builder.where('shipment_id', '=', query.shipmentId);
      const rows = await builder
        .orderBy('created_at', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
      return Promise.all(
        rows.map(async (row) => toInvoiceDetail(row, await this.linesOf(trx, row.id), [])),
      );
    });
  }

  async get(tenantId: string, id: string): Promise<InvoiceDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const row = await trx
        .selectFrom('invoices')
        .select(INVOICE_COLUMNS)
        .where('id', '=', id)
        .executeTakeFirst();
      if (!row) throw ApiError.notFound('Invoice not found');
      const lines = await this.linesOf(trx, id);
      const payments = await this.paymentsOf(trx, id);
      return toInvoiceDetail(row, lines, payments);
    });
  }

  /**
   * Creates an invoice either from an accepted quote (a snapshot, so later
   * quote edits cannot alter an issued invoice) or from standalone lines.
   */
  async create(
    tenantId: string,
    actorUserId: string,
    shipmentId: string,
    input: CreateInvoiceInput,
    meta: RequestMeta,
  ): Promise<InvoiceDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      await this.assertShipment(trx, shipmentId);
      const config = await loadBillingConfig(trx);

      let priced;
      let quoteId: string | null = null;
      let exchangeRate: string | null = null;

      if (input.quoteId) {
        const quote = await trx
          .selectFrom('quotes')
          .select(['id', 'shipment_id', 'status', 'currency'])
          .where('id', '=', input.quoteId)
          .executeTakeFirst();
        if (!quote) throw ApiError.notFound('Quote not found');
        if (quote.shipment_id !== shipmentId) {
          throw ApiError.validation('The quote belongs to a different shipment');
        }
        if (quote.status !== 'accepted') {
          throw ApiError.conflict('Only an accepted quote can be invoiced');
        }

        const quoteLines = await trx
          .selectFrom('quote_lines')
          .select(QUOTE_LINE_COLUMNS)
          .where('quote_id', '=', quote.id)
          .orderBy('sort_order', 'asc')
          .execute();

        let factor = 1;
        if (quote.currency !== 'ZMW') {
          if (!input.exchangeRate) {
            throw ApiError.validation('An exchange rate is required for a non-ZMW quote', [
              { field: 'exchangeRate', issue: 'required to invoice in ZMW' },
            ]);
          }
          factor = input.exchangeRate;
          exchangeRate = String(input.exchangeRate);
        }

        priced = await priceValidatedLines(
          trx,
          quoteLines.map((line) => ({
            chargeType: line.charge_type_code,
            description: line.description,
            quantity: line.quantity,
            unitAmountMinor: Math.round(Number(line.unit_amount_minor) * factor),
          })),
          config,
        );
        quoteId = quote.id;
      } else {
        priced = await priceValidatedLines(trx, input.lines ?? [], config);
      }

      const number = await allocateNumber(trx, tenantId);
      const invoiceId = uuidv7();
      const issueNow = input.issueNow;
      const issuedAt = issueNow ? new Date() : null;

      const row = await trx
        .insertInto('invoices')
        .values({
          id: invoiceId,
          tenant_id: tenantId,
          shipment_id: shipmentId,
          quote_id: quoteId,
          number,
          status: issueNow ? 'issued' : 'draft',
          issue_date: issueNow ? asDate(todayIso()) : null,
          due_date: asDate(input.dueDate),
          notes: input.notes ?? null,
          exchange_rate: exchangeRate,
          vat_rate_bp: config.vatRateBp,
          vat_verification_status: config.vatVerificationStatus,
          subtotal_minor: priced.subtotalMinor,
          tax_minor: priced.taxMinor,
          total_minor: priced.totalMinor,
          issued_at: issuedAt,
          created_by: actorUserId,
          updated_by: actorUserId,
        })
        .returning(INVOICE_COLUMNS)
        .executeTakeFirstOrThrow();

      await this.insertLines(trx, tenantId, invoiceId, priced.lines);

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'invoice.created',
        entityType: 'invoice',
        entityId: invoiceId,
        metadata: { number, quoteId, totalMinor: priced.totalMinor, issued: issueNow },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const lines = await this.linesOf(trx, invoiceId);
      return toInvoiceDetail(row, lines, []);
    });
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: UpdateInvoiceInput,
    meta: RequestMeta,
  ): Promise<InvoiceDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const current = await trx
        .selectFrom('invoices')
        .select(['id', 'status'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!current) throw ApiError.notFound('Invoice not found');
      if (current.status !== 'draft') {
        throw ApiError.conflict('Only a draft invoice can be edited');
      }

      const config = await loadBillingConfig(trx);
      const pricing = input.lines ? await priceValidatedLines(trx, input.lines, config) : null;

      await trx
        .updateTable('invoices')
        .set({
          ...(input.dueDate !== undefined ? { due_date: asDate(input.dueDate) } : {}),
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
        .execute();

      if (pricing) {
        await trx.deleteFrom('invoice_lines').where('invoice_id', '=', id).execute();
        await this.insertLines(trx, tenantId, id, pricing.lines);
      }

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'invoice.updated',
        entityType: 'invoice',
        entityId: id,
        metadata: { fields: Object.keys(input) },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return this.detail(trx, id);
    });
  }

  async issue(
    tenantId: string,
    actorUserId: string,
    id: string,
    meta: RequestMeta,
  ): Promise<InvoiceDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const current = await trx
        .selectFrom('invoices')
        .select(['id', 'status'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!current) throw ApiError.notFound('Invoice not found');
      if (current.status !== 'draft') {
        throw ApiError.conflict('Only a draft invoice can be issued');
      }

      const row = await trx
        .updateTable('invoices')
        .set({
          status: 'issued',
          issue_date: asDate(todayIso()),
          issued_at: new Date(),
          updated_by: actorUserId,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returning(INVOICE_COLUMNS)
        .executeTakeFirstOrThrow();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'invoice.issued',
        entityType: 'invoice',
        entityId: id,
        metadata: { number: row.number },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return this.detail(trx, id);
    });
  }

  /**
   * Voids an invoice. Issued documents are never edited or deleted; a wrong
   * invoice is voided (with a reason) and reissued.
   */
  async voidInvoice(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: VoidInvoiceInput,
    meta: RequestMeta,
  ): Promise<InvoiceDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const current = await trx
        .selectFrom('invoices')
        .select(['id', 'status'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!current) throw ApiError.notFound('Invoice not found');
      if (current.status === 'void') throw ApiError.conflict('Invoice is already void');
      if (current.status === 'paid') {
        throw ApiError.conflict('A paid invoice cannot be voided');
      }

      const row = await trx
        .updateTable('invoices')
        .set({
          status: 'void',
          voided_at: new Date(),
          void_reason: input.reason,
          updated_by: actorUserId,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returning(INVOICE_COLUMNS)
        .executeTakeFirstOrThrow();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'invoice.voided',
        entityType: 'invoice',
        entityId: id,
        metadata: { number: row.number, reason: input.reason },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return this.detail(trx, id);
    });
  }

  async recordPayment(
    tenantId: string,
    actorUserId: string,
    invoiceId: string,
    input: RecordPaymentInput,
    meta: RequestMeta,
  ): Promise<InvoiceDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const current = await trx
        .selectFrom('invoices')
        .select(['id', 'status', 'total_minor', 'amount_paid_minor'])
        .where('id', '=', invoiceId)
        .executeTakeFirst();
      if (!current) throw ApiError.notFound('Invoice not found');
      if (current.status === 'draft' || current.status === 'void') {
        throw ApiError.conflict('Payments can only be recorded against an issued invoice');
      }

      const paymentId = uuidv7();
      await trx
        .insertInto('payments')
        .values({
          id: paymentId,
          tenant_id: tenantId,
          invoice_id: invoiceId,
          amount_minor: input.amountMinor,
          method: input.method,
          reference: input.reference ?? null,
          paid_on: asDate(input.paidOn) as Date,
          note: input.note ?? null,
          recorded_by: actorUserId,
        })
        .execute();

      const totalMinor = Number(current.total_minor);
      const paidMinor = Number(current.amount_paid_minor) + input.amountMinor;
      const derived = paymentStatusFor(totalMinor, paidMinor);
      const status: 'issued' | 'partially_paid' | 'paid' =
        derived === 'unpaid' ? 'issued' : derived;

      await trx
        .updateTable('invoices')
        .set({
          amount_paid_minor: paidMinor,
          status,
          updated_by: actorUserId,
          updated_at: new Date(),
        })
        .where('id', '=', invoiceId)
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'payment.recorded',
        entityType: 'payment',
        entityId: paymentId,
        metadata: { invoiceId, amountMinor: input.amountMinor, method: input.method },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return this.detail(trx, invoiceId);
    });
  }

  async listPayments(
    tenantId: string,
    invoiceId: string,
  ): Promise<ReturnType<typeof toPaymentSummary>[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      const invoice = await trx
        .selectFrom('invoices')
        .select('id')
        .where('id', '=', invoiceId)
        .executeTakeFirst();
      if (!invoice) throw ApiError.notFound('Invoice not found');
      const rows = await this.paymentsOf(trx, invoiceId);
      return rows.map(toPaymentSummary);
    });
  }

  private async detail(trx: Transaction<Database>, id: string): Promise<InvoiceDetail> {
    const row = await trx
      .selectFrom('invoices')
      .select(INVOICE_COLUMNS)
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const lines = await this.linesOf(trx, id);
    const payments = await this.paymentsOf(trx, id);
    return toInvoiceDetail(row, lines, payments);
  }

  private async assertShipment(trx: Transaction<Database>, shipmentId: string): Promise<void> {
    const shipment = await trx
      .selectFrom('shipments')
      .select('id')
      .where('id', '=', shipmentId)
      .executeTakeFirst();
    if (!shipment) throw ApiError.notFound('Shipment not found');
  }

  private async linesOf(trx: Transaction<Database>, invoiceId: string) {
    return trx
      .selectFrom('invoice_lines')
      .select(INVOICE_LINE_COLUMNS)
      .where('invoice_id', '=', invoiceId)
      .orderBy('sort_order', 'asc')
      .execute();
  }

  private async paymentsOf(trx: Transaction<Database>, invoiceId: string): Promise<PaymentRow[]> {
    return trx
      .selectFrom('payments')
      .select(PAYMENT_COLUMNS)
      .where('invoice_id', '=', invoiceId)
      .orderBy('created_at', 'asc')
      .execute();
  }

  private async insertLines(
    trx: Transaction<Database>,
    tenantId: string,
    invoiceId: string,
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
      .insertInto('invoice_lines')
      .values(
        lines.map((line, index) => ({
          id: uuidv7(),
          tenant_id: tenantId,
          invoice_id: invoiceId,
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
}

/**
 * Reserves the next per-tenant invoice number. The upsert is atomic and also
 * takes the row lock, so concurrent issues cannot collide.
 */
async function allocateNumber(trx: Transaction<Database>, tenantId: string): Promise<string> {
  const row = await trx
    .insertInto('invoice_counters')
    .values({ tenant_id: tenantId, last_number: 1 })
    .onConflict((oc) =>
      oc.column('tenant_id').doUpdateSet((eb) => ({
        last_number: eb('invoice_counters.last_number', '+', 1),
      })),
    )
    .returning('last_number')
    .executeTakeFirstOrThrow();
  return `INV-${todayIso().slice(0, 4)}-${String(row.last_number).padStart(4, '0')}`;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
