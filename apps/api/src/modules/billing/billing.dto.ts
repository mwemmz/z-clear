import { z } from 'zod';
import { CURRENCIES } from '@zclear/shared';

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'card', 'other'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');
const reference = z.string().trim().min(1).max(100);
const notes = z.string().trim().max(1000);
const moneyMinor = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().int().min(1).max(1_000_000);

const lineInput = z
  .object({
    chargeType: z.string().trim().min(1).max(64),
    description: z.string().trim().min(1).max(300),
    quantity,
    unitAmountMinor: moneyMinor,
  })
  .strict();

const lines = z.array(lineInput).min(1).max(200);

export const createQuoteSchema = z
  .object({
    reference,
    currency: z.enum(CURRENCIES).default('ZMW'),
    validUntil: isoDate.optional(),
    notes: notes.optional(),
    lines,
  })
  .strict();

export const updateQuoteSchema = z
  .object({
    reference: reference.optional(),
    currency: z.enum(CURRENCIES).optional(),
    validUntil: isoDate.nullable().optional(),
    notes: notes.nullable().optional(),
    lines: lines.optional(),
  })
  .strict();

export const quoteStatusSchema = z
  .object({
    status: z.enum(['sent', 'accepted', 'declined', 'expired']),
    note: notes.optional(),
  })
  .strict();

export const createInvoiceSchema = z
  .object({
    quoteId: z.string().uuid().optional(),
    lines: lines.optional(),
    dueDate: isoDate.optional(),
    notes: notes.optional(),
    // Required only when converting a non-ZMW quote (invoices are ZMW only).
    exchangeRate: z.number().positive().max(1_000_000).optional(),
    issueNow: z.boolean().default(false),
  })
  .strict()
  .refine((value) => Boolean(value.quoteId) || Boolean(value.lines), {
    message: 'either quoteId or lines is required',
    path: ['quoteId'],
  });

export const updateInvoiceSchema = z
  .object({
    dueDate: isoDate.nullable().optional(),
    notes: notes.nullable().optional(),
    lines: lines.optional(),
  })
  .strict();

export const voidInvoiceSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export const recordPaymentSchema = z
  .object({
    amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().min(1).max(100).optional(),
    paidOn: isoDate,
    note: notes.optional(),
  })
  .strict();

export const listInvoicesSchema = z
  .object({
    status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'void']).optional(),
    shipmentId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type LineInput = z.infer<typeof lineInput>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type QuoteStatusInput = z.infer<typeof quoteStatusSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesSchema>;

export interface BillingLine {
  id: string;
  chargeType: string;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  lineAmountMinor: number;
  isTaxable: boolean;
  taxMinor: number;
  sortOrder: number;
}

export interface QuoteDetail {
  id: string;
  shipmentId: string;
  reference: string;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  validUntil: string | null;
  notes: string | null;
  vatRateBp: number;
  vatVerificationStatus: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  lines: BillingLine[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummary {
  id: string;
  amountMinor: number;
  currency: string;
  method: string;
  reference: string | null;
  paidOn: string;
  note: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface InvoiceDetail {
  id: string;
  shipmentId: string;
  quoteId: string | null;
  number: string;
  currency: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  exchangeRate: string | null;
  vatRateBp: number;
  vatVerificationStatus: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  lines: BillingLine[];
  payments: PaymentSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface QuoteSummary {
  id: string;
  shipmentId: string;
  reference: string;
  currency: string;
  status: QuoteDetail['status'];
  totalMinor: number;
  validUntil: string | null;
  createdAt: string;
}
