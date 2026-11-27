import { personaliseChecklist, type ChecklistRule, type VerificationStatus } from './checklist';
import type { CaseKind } from './importer-case';
import { taxOnAmount } from './pricing';

/**
 * Compliance assistant and estimator helpers.
 *
 * Guardrails: no duty, VAT, fee or legal requirement is invented here. Tariff
 * rules are external data carrying a source URL, effective date and
 * verification status. The estimator will only use a `VERIFIED` rule, and a
 * `SAMPLE` rule only when demo mode is explicitly enabled. Everything else is
 * refused. The "assistant" only rephrases the agency's own configured
 * guidance; it never decides what customs requires. Customs happens in
 * ASYCUDA World.
 */

export type TariffVerificationStatus = VerificationStatus | 'SAMPLE';

export interface TariffRule {
  hsCode: string;
  description: string;
  /** Rate in basis points. Always supplied by external data, never in code. */
  rateBp: number;
  sourceUrl: string;
  /** ISO date (YYYY-MM-DD) from the source. */
  effectiveDate: string;
  verificationStatus: TariffVerificationStatus;
}

export interface EstimateInput {
  hsCode: string;
  /** User-entered customs value in integer minor units. Never assessed here. */
  customsValueMinor: number;
  currency: string;
}

export interface EstimateRuleSource {
  hsCode: string;
  description: string;
  sourceUrl: string;
  effectiveDate: string;
  verificationStatus: TariffVerificationStatus;
}

export interface EstimateSuccess {
  kind: 'estimate';
  amountMinor: number;
  currency: string;
  rateBp: number;
  basis: 'VERIFIED' | 'SAMPLE';
  rule: EstimateRuleSource;
  notice: string;
}

export interface EstimateRefusal {
  kind: 'refused';
  reason: 'invalid_input' | 'no_verified_rule' | 'sample_mode_disabled';
  notice: string;
}

export type EstimateOutcome = EstimateSuccess | EstimateRefusal;

export const COMPLIANCE_ESTIMATE_NOTICE =
  'Illustrative estimate only. Z Clear does not assess duty, VAT or fees, decide customs value or file declarations. Customs amounts are decided in ASYCUDA World. Do not pay or file on this figure.';

export const COMPLIANCE_ASSISTANT_NOTICE =
  'These are questions to confirm with your agency, not legal advice or a ZRA requirement. Z Clear does not decide what customs requires or assess any amount; declarations and decisions happen in ASYCUDA World.';

const HS_CODE = /^\d{6,10}$/;
const CURRENCY = /^[A-Z]{3}$/;

/**
 * Pure estimator. Only a `VERIFIED` rule may produce a figure; `SAMPLE` rules
 * require explicit demo-mode opt-in; `NEEDS_VERIFICATION` and `SUPERSEDED`
 * rules are never used. Matching is on the first six digits of the HS code.
 */
export function estimateFromRules(
  input: EstimateInput,
  rules: readonly TariffRule[],
  options: { allowSample: boolean },
): EstimateOutcome {
  if (
    !HS_CODE.test(input.hsCode) ||
    !CURRENCY.test(input.currency) ||
    !Number.isInteger(input.customsValueMinor) ||
    input.customsValueMinor < 0
  ) {
    return { kind: 'refused', reason: 'invalid_input', notice: COMPLIANCE_ESTIMATE_NOTICE };
  }

  const prefix = input.hsCode.slice(0, 6);
  const matches = rules.filter((rule) => rule.hsCode.replace(/\D/g, '').startsWith(prefix));
  const verified = matches.find((rule) => rule.verificationStatus === 'VERIFIED');
  if (verified) return success(input, verified, 'VERIFIED');

  const sample = matches.find((rule) => rule.verificationStatus === 'SAMPLE');
  if (sample && options.allowSample) return success(input, sample, 'SAMPLE');
  if (sample) {
    return { kind: 'refused', reason: 'sample_mode_disabled', notice: COMPLIANCE_ESTIMATE_NOTICE };
  }
  return { kind: 'refused', reason: 'no_verified_rule', notice: COMPLIANCE_ESTIMATE_NOTICE };
}

function success(
  input: EstimateInput,
  rule: TariffRule,
  basis: 'VERIFIED' | 'SAMPLE',
): EstimateSuccess {
  return {
    kind: 'estimate',
    amountMinor: taxOnAmount(input.customsValueMinor, rule.rateBp),
    currency: input.currency,
    rateBp: rule.rateBp,
    basis,
    rule: {
      hsCode: rule.hsCode,
      description: rule.description,
      sourceUrl: rule.sourceUrl,
      effectiveDate: rule.effectiveDate,
      verificationStatus: rule.verificationStatus,
    },
    notice: COMPLIANCE_ESTIMATE_NOTICE,
  };
}

export interface CompliancePrompt {
  id: string;
  /** Wording only. Never a legal requirement or an amount. */
  text: string;
  origin: 'agency_requirement' | 'case_fact';
  verificationStatus: VerificationStatus | null;
  sourceUrl: string | null;
  effectiveDate: string | null;
}

/**
 * Turns the agency's own configured checklist into questions to confirm, plus
 * one prompt about the value the importer typed. It adds no requirements of
 * its own and carries provenance so the UI can label unverified rows.
 */
export function compliancePrompts(input: {
  rules: readonly ChecklistRule[];
  caseKind: CaseKind;
  recordedValueFormatted: string | null;
}): CompliancePrompt[] {
  const visible = personaliseChecklist(input.rules, input.caseKind);
  const prompts: CompliancePrompt[] = visible.rules.map((rule) => ({
    id: `agency:${rule.docType}`,
    text: `Confirm with your agency: ${rule.label}.`,
    origin: 'agency_requirement',
    verificationStatus: rule.verificationStatus,
    sourceUrl: rule.sourceUrl,
    effectiveDate: rule.effectiveDate,
  }));

  if (input.recordedValueFormatted) {
    prompts.push({
      id: 'case:recorded-value',
      text: `Check that the value you recorded (${input.recordedValueFormatted}) matches your documents. Ask your agency if you are unsure.`,
      origin: 'case_fact',
      verificationStatus: null,
      sourceUrl: null,
      effectiveDate: null,
    });
  }
  return prompts;
}
