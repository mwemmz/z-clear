import { formatMoney, type CurrencyCode } from './money';
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from './shipment-stage';

/**
 * Plain-language answers for the importer's "My case" page. Every answer is
 * derived from recorded data; this helper never calculates duty, tax or a legal
 * requirement, and never claims a customs decision has been made.
 */
export interface CaseStatusInvoice {
  number: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  currency: CurrencyCode;
  balanceMinor: number;
}

export interface CaseStatusInput {
  stage: ShipmentStatus;
  holdReason: string | null;
  invoices: CaseStatusInvoice[];
  missingMandatory: number;
}

export interface CaseStatusAnswer {
  question: string;
  answer: string;
}

export const CASE_STATUS_NOTICE =
  'Stages are your agency’s manual record. Customs steps happen in ASYCUDA World; Z Clear does not assess duty or decide release.';

export function caseStatusAnswers(input: CaseStatusInput): CaseStatusAnswer[] {
  const activeInvoices = input.invoices.filter((invoice) => invoice.status !== 'void');
  const unpaid = activeInvoices.find((invoice) => invoice.balanceMinor > 0);
  const stageLabel = SHIPMENT_STATUS_LABELS[input.stage];

  let need: string;
  if (input.holdReason) {
    need = `Your agency has paused the case: ${input.holdReason}. Ask them what they need from you.`;
  } else if (input.missingMandatory > 0) {
    need = `Your checklist shows ${input.missingMandatory} item${input.missingMandatory === 1 ? '' : 's'} still needed. Confirm the details with your agency.`;
  } else {
    need = 'No outstanding checklist item is shown. Ask your agency if anything else is needed.';
  }

  let money: string;
  if (unpaid) {
    const amount = formatMoney({ amountMinor: unpaid.balanceMinor, currency: unpaid.currency });
    money = `${amount} is recorded as owing on invoice ${unpaid.number}. This is your agency’s record, not a ZRA assessment.`;
  } else if (activeInvoices.length === 0) {
    money = 'No invoice has been issued for this case yet.';
  } else {
    money = 'No unpaid invoice balance is recorded.';
  }

  let next: string;
  if (input.stage === 'on_hold') {
    next = 'Your agency will update the case when the hold is resolved.';
  } else if (input.stage === 'delivered') {
    next = 'No further stage is recorded for this case.';
  } else {
    next =
      'Your agency will record the next stage as work progresses. Customs steps are handled in ASYCUDA World.';
  }

  return [
    {
      question: 'Where is my case?',
      answer: `${stageLabel}. This is the latest stage your agency recorded.`,
    },
    { question: 'Do you need anything from me?', answer: need },
    { question: 'What do I owe?', answer: money },
    { question: 'What happens next?', answer: next },
  ];
}
