import type {
  BillingLine,
  InvoiceDetail,
  PaymentSummary,
  QuoteDetail,
  QuoteSummary,
} from './billing.dto';

export interface QuoteLineRow {
  id: string;
  charge_type_code: string;
  description: string;
  quantity: number;
  unit_amount_minor: number | string;
  line_amount_minor: number | string;
  is_taxable: boolean;
  tax_minor: number | string;
  sort_order: number;
}

export interface PaymentRow {
  id: string;
  amount_minor: number | string;
  currency: string;
  method: string;
  reference: string | null;
  paid_on: Date | string;
  note: string | null;
  recorded_by: string | null;
  created_at: Date;
}

export interface QuoteRow {
  id: string;
  shipment_id: string;
  reference: string;
  currency: string;
  status: QuoteDetail['status'];
  valid_until: Date | null;
  notes: string | null;
  vat_rate_bp: number;
  vat_verification_status: string;
  subtotal_minor: number | string;
  tax_minor: number | string;
  total_minor: number | string;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceRow {
  id: string;
  shipment_id: string;
  quote_id: string | null;
  number: string;
  currency: string;
  status: InvoiceDetail['status'];
  issue_date: Date | null;
  due_date: Date | null;
  notes: string | null;
  exchange_rate: string | null;
  vat_rate_bp: number;
  vat_verification_status: string;
  subtotal_minor: number | string;
  tax_minor: number | string;
  total_minor: number | string;
  amount_paid_minor: number | string;
  issued_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

const toMoney = (value: number | string): number => Number(value);

function toDateOnly(value: Date | string | null): string | null {
  if (value === null) return null;
  // `pg` parses DATE columns to a local-midnight Date; read the calendar
  // components rather than the UTC instant so the day never shifts.
  if (typeof value === 'string') return value.slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

export function toBillingLine(row: QuoteLineRow): BillingLine {
  return {
    id: row.id,
    chargeType: row.charge_type_code,
    description: row.description,
    quantity: row.quantity,
    unitAmountMinor: toMoney(row.unit_amount_minor),
    lineAmountMinor: toMoney(row.line_amount_minor),
    isTaxable: row.is_taxable,
    taxMinor: toMoney(row.tax_minor),
    sortOrder: row.sort_order,
  };
}

export function toPaymentSummary(row: PaymentRow): PaymentSummary {
  return {
    id: row.id,
    amountMinor: toMoney(row.amount_minor),
    currency: row.currency,
    method: row.method,
    reference: row.reference,
    paidOn: toDateOnly(row.paid_on) ?? '',
    note: row.note,
    recordedBy: row.recorded_by,
    createdAt: row.created_at.toISOString(),
  };
}

export function toQuoteSummary(row: QuoteRow): QuoteSummary {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    reference: row.reference,
    currency: row.currency,
    status: row.status,
    totalMinor: toMoney(row.total_minor),
    validUntil: toDateOnly(row.valid_until),
    createdAt: row.created_at.toISOString(),
  };
}

export function toQuoteDetail(row: QuoteRow, lines: QuoteLineRow[]): QuoteDetail {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    reference: row.reference,
    currency: row.currency,
    status: row.status,
    validUntil: toDateOnly(row.valid_until),
    notes: row.notes,
    vatRateBp: row.vat_rate_bp,
    vatVerificationStatus: row.vat_verification_status,
    subtotalMinor: toMoney(row.subtotal_minor),
    taxMinor: toMoney(row.tax_minor),
    totalMinor: toMoney(row.total_minor),
    lines: lines.map(toBillingLine),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toInvoiceDetail(
  row: InvoiceRow,
  lines: QuoteLineRow[],
  payments: PaymentRow[],
): InvoiceDetail {
  const totalMinor = toMoney(row.total_minor);
  const amountPaidMinor = toMoney(row.amount_paid_minor);
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    quoteId: row.quote_id,
    number: row.number,
    currency: row.currency,
    status: row.status,
    issueDate: toDateOnly(row.issue_date),
    dueDate: toDateOnly(row.due_date),
    notes: row.notes,
    exchangeRate: row.exchange_rate,
    vatRateBp: row.vat_rate_bp,
    vatVerificationStatus: row.vat_verification_status,
    subtotalMinor: toMoney(row.subtotal_minor),
    taxMinor: toMoney(row.tax_minor),
    totalMinor,
    amountPaidMinor,
    balanceMinor: Math.max(0, totalMinor - amountPaidMinor),
    issuedAt: row.issued_at ? row.issued_at.toISOString() : null,
    voidedAt: row.voided_at ? row.voided_at.toISOString() : null,
    voidReason: row.void_reason,
    lines: lines.map(toBillingLine),
    payments: payments.map(toPaymentSummary),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
