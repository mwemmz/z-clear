import { Injectable } from '@nestjs/common';
import {
  PROGRAM_NOT_CONFIGURED_NOTICE,
  isProgrammeConfigured,
  programmeNotice,
  type PointLedgerEntry,
  type PointsSummary,
  type ProgramConfigSummary,
  type ReferralsSummary,
} from '@zclear/shared';
import type { Transaction } from 'kysely';
import { DatabaseService } from '../../database/database.service';
import type { Database, LoyaltyProgramType } from '../../database/database.types';
import type { ListPointLedgerQuery } from './loyalty.dto';

function emptyProgram(): ProgramConfigSummary {
  return {
    version: 0,
    verificationStatus: 'NEEDS_VERIFICATION',
    configuredAt: null,
    notice: PROGRAM_NOT_CONFIGURED_NOTICE,
  };
}

/**
 * Read-only loyalty structure. A programme is inert until an owner-supplied,
 * versioned config row is VERIFIED. Balances are null rather than zero while
 * unconfigured, and legacy review-point rows are not exposed here: they belong
 * to the old fixed-value review workflow, not to verified programme rules.
 */
@Injectable()
export class LoyaltyService {
  constructor(private readonly db: DatabaseService) {}

  async pointsMe(tenantId: string, userId: string): Promise<PointsSummary> {
    return this.db.withTenant(tenantId, async (trx) => {
      const program = await this.currentProgram(trx, 'points');
      if (!isProgrammeConfigured(program)) {
        return { program, balance: null, ledger: [] };
      }

      const rows = await trx
        .selectFrom('point_ledger_entries')
        .select(['id', 'reason_code', 'source_type', 'source_id', 'points', 'created_at'])
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute();

      return {
        program,
        balance: rows.reduce((total, row) => total + row.points, 0),
        ledger: rows.map(toLedgerEntry),
      };
    });
  }

  async pointsLedger(
    tenantId: string,
    userId: string,
    query: ListPointLedgerQuery,
  ): Promise<PointLedgerEntry[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      const program = await this.currentProgram(trx, 'points');
      if (!isProgrammeConfigured(program)) return [];

      const rows = await trx
        .selectFrom('point_ledger_entries')
        .select(['id', 'reason_code', 'source_type', 'source_id', 'points', 'created_at'])
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
      return rows.map(toLedgerEntry);
    });
  }

  async referralsMe(tenantId: string, userId: string): Promise<ReferralsSummary> {
    return this.db.withTenant(tenantId, async (trx) => {
      const program = await this.currentProgram(trx, 'referrals');
      if (!isProgrammeConfigured(program)) return { program, records: [] };

      const rows = await trx
        .selectFrom('referral_records')
        .select(['id', 'state', 'created_at'])
        .where('referrer_user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute();

      return {
        program,
        records: rows.map((row) => ({
          id: row.id,
          state: row.state,
          createdAt: row.created_at.toISOString(),
        })),
      };
    });
  }

  private async currentProgram(
    trx: Transaction<Database>,
    programType: LoyaltyProgramType,
  ): Promise<ProgramConfigSummary> {
    const row = await trx
      .selectFrom('loyalty_program_config')
      .select(['version', 'verification_status', 'configured_at'])
      .where('program_type', '=', programType)
      .orderBy('version', 'desc')
      .executeTakeFirst();

    if (!row) return emptyProgram();

    const program: ProgramConfigSummary = {
      version: row.version,
      verificationStatus: row.verification_status,
      configuredAt: row.configured_at?.toISOString() ?? null,
      notice: '',
    };
    return { ...program, notice: programmeNotice(program) };
  }
}

function toLedgerEntry(row: {
  id: string;
  reason_code: string;
  source_type: 'configured_event' | 'manual_adjustment';
  source_id: string | null;
  points: number;
  created_at: Date;
}): PointLedgerEntry {
  return {
    id: row.id,
    reasonCode: row.reason_code,
    sourceType: row.source_type,
    sourceId: row.source_id,
    points: row.points,
    createdAt: row.created_at.toISOString(),
  };
}
