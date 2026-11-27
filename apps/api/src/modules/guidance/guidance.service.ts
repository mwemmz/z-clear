import { Injectable } from '@nestjs/common';
import { formatDateOnly } from '../../common/dates';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import type { VerificationStatus } from '../../database/database.types';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import type {
  CreateGuidanceInput,
  GuidanceView,
  ListGuidanceQuery,
  UpdateGuidanceInput,
} from './guidance.dto';

const COLUMNS = [
  'id',
  'step_key',
  'title',
  'detail',
  'sort_order',
  'is_active',
  'source_url',
  'effective_date',
  'verification_status',
] as const;

/** Every change is audited; the guidance itself is tenant configuration. */
@Injectable()
export class GuidanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ListGuidanceQuery): Promise<GuidanceView[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      let builder = trx.selectFrom('registry_guidance').select(COLUMNS);
      if (!query.includeInactive) builder = builder.where('is_active', '=', true);
      const rows = await builder.orderBy('sort_order').orderBy('step_key').execute();
      return rows.map(toView);
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    input: CreateGuidanceInput,
    meta: RequestMeta,
  ): Promise<GuidanceView> {
    return this.db.withTenant(tenantId, async (trx) => {
      const duplicate = await trx
        .selectFrom('registry_guidance')
        .select('id')
        .where('step_key', '=', input.stepKey)
        .executeTakeFirst();
      if (duplicate) {
        throw ApiError.conflict('That guidance step is already configured for this agency');
      }

      const id = uuidv7();
      await trx
        .insertInto('registry_guidance')
        .values({
          id,
          tenant_id: tenantId,
          step_key: input.stepKey,
          title: input.title,
          detail: input.detail ?? null,
          sort_order: input.sortOrder,
          is_active: true,
          source_url: input.sourceUrl ?? null,
          effective_date: input.effectiveDate ? asDate(input.effectiveDate) : null,
          verification_status: input.verificationStatus,
        })
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'guidance.created',
        entityType: 'registry_guidance',
        entityId: id,
        metadata: { stepKey: input.stepKey, verificationStatus: input.verificationStatus },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return {
        id,
        stepKey: input.stepKey,
        title: input.title,
        detail: input.detail ?? null,
        sortOrder: input.sortOrder,
        isActive: true,
        sourceUrl: input.sourceUrl ?? null,
        effectiveDate: input.effectiveDate ?? null,
        verificationStatus: input.verificationStatus,
        isVerified: input.verificationStatus === 'VERIFIED',
      };
    });
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: UpdateGuidanceInput,
    meta: RequestMeta,
  ): Promise<GuidanceView> {
    return this.db.withTenant(tenantId, async (trx) => {
      const existing = await trx
        .selectFrom('registry_guidance')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst();
      if (!existing) throw ApiError.notFound('Guidance step not found');

      await trx
        .updateTable('registry_guidance')
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.detail !== undefined ? { detail: input.detail } : {}),
          ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
          ...(input.sourceUrl !== undefined ? { source_url: input.sourceUrl } : {}),
          ...(input.effectiveDate !== undefined
            ? { effective_date: input.effectiveDate ? asDate(input.effectiveDate) : null }
            : {}),
          ...(input.verificationStatus !== undefined
            ? { verification_status: input.verificationStatus }
            : {}),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'guidance.updated',
        entityType: 'registry_guidance',
        entityId: id,
        metadata: { fields: Object.keys(input) },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const updated = await trx
        .selectFrom('registry_guidance')
        .select(COLUMNS)
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      return toView(updated);
    });
  }

  async remove(
    tenantId: string,
    actorUserId: string,
    id: string,
    meta: RequestMeta,
  ): Promise<{ ok: true }> {
    return this.db.withTenant(tenantId, async (trx) => {
      const existing = await trx
        .selectFrom('registry_guidance')
        .select('step_key')
        .where('id', '=', id)
        .executeTakeFirst();
      if (!existing) throw ApiError.notFound('Guidance step not found');

      await trx.deleteFrom('registry_guidance').where('id', '=', id).execute();
      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'guidance.deleted',
        entityType: 'registry_guidance',
        entityId: id,
        metadata: { stepKey: existing.step_key },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return { ok: true } as const;
    });
  }
}

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toView(row: {
  id: string;
  step_key: string;
  title: string;
  detail: string | null;
  sort_order: number;
  is_active: boolean;
  source_url: string | null;
  effective_date: Date | null;
  verification_status: VerificationStatus;
}): GuidanceView {
  return {
    id: row.id,
    stepKey: row.step_key,
    title: row.title,
    detail: row.detail,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    sourceUrl: row.source_url,
    effectiveDate: row.effective_date ? formatDateOnly(row.effective_date) : null,
    verificationStatus: row.verification_status,
    isVerified: row.verification_status === 'VERIFIED' && Boolean(row.source_url),
  };
}
