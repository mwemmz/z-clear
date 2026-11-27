import type { InvoiceDetail } from './billing.dto';

/**
 * Minimal, dependency-free PDF renderer for an issued invoice snapshot.
 * Deterministic: the same invoice always renders the same bytes (apart from the
 * invoice's own data). Text is WinAnsi-safe ASCII; anything else becomes '?'.
 */
function escapePdfText(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
}

function minor(amountMinor: number): string {
  return `${(amountMinor / 100).toFixed(2)}`;
}

export function renderInvoicePdf(invoice: InvoiceDetail): Buffer {
  const textLines = [
    'Z Clear',
    `Invoice ${invoice.number}`,
    `Status: ${invoice.status}`,
    `Issue date: ${invoice.issueDate ?? 'not issued'}`,
    `Currency: ${invoice.currency}`,
    '',
    'Description                       Qty    Amount       Tax',
  ];

  for (const line of invoice.lines) {
    textLines.push(
      `${line.description.slice(0, 32).padEnd(32)} ${String(line.quantity).padStart(4)} ${minor(line.lineAmountMinor).padStart(10)} ${minor(line.taxMinor).padStart(9)}`,
    );
  }

  textLines.push(
    '',
    `Subtotal: ${minor(invoice.subtotalMinor)}`,
    `VAT: ${minor(invoice.taxMinor)} (${invoice.vatRateBp} bp, ${invoice.vatVerificationStatus})`,
    `Total: ${minor(invoice.totalMinor)}`,
    `Paid: ${minor(invoice.amountPaidMinor)}`,
    `Balance: ${minor(invoice.balanceMinor)}`,
    '',
    'VAT is configuration pending verification. Confirm rates against current ZRA sources.',
    'Customs declaration and release happen in ASYCUDA World; this is not a customs document.',
  );

  let content = 'BT\n/F1 10 Tf\n56 780 Td\n12 TL\n';
  for (const line of textLines) {
    content += `(${escapePdfText(line)}) Tj\nT*\n`;
  }
  content += 'ET\n';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
