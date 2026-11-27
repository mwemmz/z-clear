import type { CaseKind } from './importer-case';

export type VerificationStatus = 'NEEDS_VERIFICATION' | 'VERIFIED' | 'SUPERSEDED';

/** A checklist rule as shown to an importer. It is guidance, not an assessment. */
export interface ChecklistRule {
  docType: string;
  label: string;
  isMandatory: boolean;
  sortOrder: number;
  /** NULL means the rule applies to every case kind. */
  caseKind: CaseKind | null;
  sourceUrl: string | null;
  effectiveDate: string | null;
  verificationStatus: VerificationStatus;
  satisfied: boolean;
}

export interface PersonalisedChecklist {
  caseKind: CaseKind;
  rules: ChecklistRule[];
  missingMandatory: string[];
  /** True when a visible rule is not VERIFIED against a current ZRA source. */
  hasUnverifiedRules: boolean;
  /** Fixed disclosure copy, never a legal claim or an assessment. */
  notice: string;
}

const UNVERIFIED_NOTICE =
  'This checklist is agency guidance. Items marked unverified have not been checked against a current ZRA source and are not official requirements.';

/**
 * Filter tenant-configured rules down to the importer's case kind. Pure: no
 * network, no database, no money. Verification flags are carried through so
 * the UI can label unverified rows instead of presenting them as law.
 */
export function personaliseChecklist(
  rules: readonly ChecklistRule[],
  caseKind: CaseKind,
): PersonalisedChecklist {
  const visible = rules
    .filter((rule) => rule.caseKind === null || rule.caseKind === caseKind)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.docType.localeCompare(b.docType));

  return {
    caseKind,
    rules: visible,
    missingMandatory: visible
      .filter((rule) => rule.isMandatory && !rule.satisfied)
      .map((rule) => rule.docType),
    hasUnverifiedRules: visible.some((rule) => rule.verificationStatus !== 'VERIFIED'),
    notice: UNVERIFIED_NOTICE,
  };
}
