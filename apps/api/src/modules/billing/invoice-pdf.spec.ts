import { describe, expect, it } from 'vitest';
import type { InvoiceDetail } from './billing.dto';
import { renderInvoicePdf } from './invoice-pdf';

function sample(): InvoiceDetail {
  return {
    id: '01920000-0000-7000-8000-000000000001',
    shipmentId: '01920000-0000-7000-8000-000000000002',
    quoteId: null,
    number: 'INV-2026-0001',
    currency: 'ZMW',
    status: 'issued',
    issueDate: '2026-11-26',
    dueDate: null,
    notes: null,
    exchangeRate: null,
    vatRateBp: 1600,
    vatVerificationStatus: 'NEEDS_VERIFICATION',
    subtotalMinor: 600_000,
    taxMinor: 16_000,
    totalMinor: 616_000,
    amountPaidMinor: 0,
    balanceMinor: 616_000,
    issuedAt: '2026-11-26T08:00:00.000Z',
    voidedAt: null,
    voidReason: null,
    lines: [
      {
        id: '01920000-0000-7000-8000-000000000003',
        chargeType: 'agency_fee',
        description: 'Clearance (P&L) fee',
        quantity: 1,
        unitAmountMinor: 100_000,
        lineAmountMinor: 100_000,
        isTaxable: true,
        taxMinor: 16_000,
        sortOrder: 1,
      },
    ],
    payments: [],
    createdAt: '2026-11-26T08:00:00.000Z',
    updatedAt: '2026-11-26T08:00:00.000Z',
  };
}

describe('renderInvoicePdf', () => {
  it('produces a well-formed PDF containing the invoice number and totals', () => {
    const pdf = renderInvoicePdf(sample()).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('INV-2026-0001');
    expect(pdf).toContain('6160.00');
    expect(pdf).toContain('NEEDS_VERIFICATION');
    expect(pdf).toContain('xref');
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
  });

  it('escapes parentheses and replaces non-ASCII characters', () => {
    const invoice = sample();
    invoice.lines = [
      {
        ...invoice.lines[0]!,
        description: 'Fee (special) - 50%',
      },
    ];
    const pdf = renderInvoicePdf(invoice).toString('latin1');
    expect(pdf).toContain('Fee \\(special\\) - 50%');
    expect([...pdf].some((char) => char.charCodeAt(0) > 127)).toBe(false);
  });
});
