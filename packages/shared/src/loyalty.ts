/**
 * Referral and point programme contracts.
 *
 * No earning rates, redemption values, expiry windows or reward claims live
 * here. A programme is inert until owner-supplied rules are stored and marked
 * VERIFIED. Until then the UI receives null balances and an explanatory notice
 * instead of invented numbers.
 */

export const PROGRAM_VERIFICATION_STATUSES = [
  'NEEDS_VERIFICATION',
  'VERIFIED',
  'SUPERSEDED',
] as const;

export type ProgramVerificationStatus = (typeof PROGRAM_VERIFICATION_STATUSES)[number];

export const PROGRAM_NOT_CONFIGURED_NOTICE =
  'This programme has no verified rules yet. No points or rewards are earned or offered.';

export const PROGRAM_CONFIGURED_NOTICE =
  'Programme rules are configured by the owner. Changes are versioned and audited.';

export interface ProgramConfigSummary {
  /** Monotonically increasing config version; 0 means no rules have been stored. */
  version: number;
  verificationStatus: ProgramVerificationStatus;
  configuredAt: string | null;
  notice: string;
}

export const POINT_LEDGER_SOURCE_TYPES = ['configured_event', 'manual_adjustment'] as const;

export type PointLedgerSourceType = (typeof POINT_LEDGER_SOURCE_TYPES)[number];

export interface PointLedgerEntry {
  id: string;
  reasonCode: string;
  sourceType: PointLedgerSourceType;
  sourceId: string | null;
  points: number;
  createdAt: string;
}

export interface PointsSummary {
  program: ProgramConfigSummary;
  /** Null until verified rules exist; never a fabricated zero balance. */
  balance: number | null;
  ledger: PointLedgerEntry[];
}

/** Referral records are structural only until referral rules are supplied. */
export const REFERRAL_RECORD_STATES = ['recorded'] as const;
export type ReferralRecordState = (typeof REFERRAL_RECORD_STATES)[number];

export interface ReferralRecord {
  id: string;
  state: ReferralRecordState;
  createdAt: string;
}

export interface ReferralsSummary {
  program: ProgramConfigSummary;
  records: ReferralRecord[];
}

export function programmeNotice(program: ProgramConfigSummary): string {
  return program.verificationStatus === 'VERIFIED'
    ? PROGRAM_CONFIGURED_NOTICE
    : PROGRAM_NOT_CONFIGURED_NOTICE;
}

export function isProgrammeConfigured(program: ProgramConfigSummary): boolean {
  return program.verificationStatus === 'VERIFIED' && program.version > 0;
}
