import { Injectable } from '@nestjs/common';
import { formatDateOnly } from '../../common/dates';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import type { CaseKind, VerificationStatus } from '../../database/database.types';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import type {
  CreateRequirementInput,
  ListRequirementsQuery,
  RequirementView,
  UpdateRequirementInput,
} from './requirements.dto';

const COLUMNS = [
  'id',
  'shipment_type',
  'case_kind',
  'doc_type',
  'label',
  'is_mandatory',
  'sort_order',
  'is_active',
  'source_url',
  'effective_date',
  'verification_status',
] as const;

@Injectable()
export class RequirementsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ListRequirementsQuery): Promise<RequirementView[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      let builder = trx.selectFrom('document_requirements').select(COLUMNS);
      if (query.shipmentType) {
        builder = builder.where('shipment_type', '=', query.shipmentType);
      }
      if (query.caseKind) {
        builder = builder.where('case_kind', '=', query.caseKind);
      }
      const rows = await builder.orderBy('shipment_type').orderBy('sort_order').execute();
      return rows.map(toView);
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    input: CreateRequirementInput,
    meta: RequestMeta,
  ): Promise<RequirementView> {
    return this.db.withTenant(tenantId, async (trx) => {
      const duplicate = await trx
        .selectFrom('document_requirements')
        .select('id')
        .where('shipment_type', '=', input.shipmentType)
        .where((eb) =>
          input.caseKind ? eb('case_kind', '=', input.caseKind) : eb('case_kind', 'is', null),
        )
        .where('doc_type', '=', input.docType)
        .executeTakeFirst();
      if (duplicate) {
        throw ApiError.conflict('That document type is already configured for this case type');
      }

      const id = uuidv7();
      await trx
        .insertInto('document_requirements')
        .values({
          id,
          tenant_id: tenantId,
          shipment_type: input.shipmentType,
          case_kind: input.caseKind ?? null,
          doc_type: input.docType,
          label: input.label,
          is_mandatory: input.isMandatory,
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
        action: 'requirement.created',
        entityType: 'document_requirement',
        entityId: id,
        metadata: {
          shipmentType: input.shipmentType,
          caseKind: input.caseKind ?? null,
          docType: input.docType,
          verificationStatus: input.verificationStatus,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return {
        id,
        shipmentType: input.shipmentType,
        caseKind: input.caseKind ?? null,
        docType: input.docType,
        label: input.label,
        isMandatory: input.isMandatory,
        sortOrder: input.sortOrder,
        isActive: true,
        sourceUrl: input.sourceUrl ?? null,
        effectiveDate: input.effectiveDate ?? null,
        verificationStatus: input.verificationStatus,
      };
    });
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: UpdateRequirementInput,
    meta: RequestMeta,
  ): Promise<RequirementView> {
    return this.db.withTenant(tenantId, async (trx) => {
      const existing = await trx
        .selectFrom('document_requirements')
        .select(COLUMNS)
        .where('id', '=', id)
        .executeTakeFirst();
      if (!existing) throw ApiError.notFound('Document requirement not found');

      await trx
        .updateTable('document_requirements')
        .set({
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.isMandatory !== undefined ? { is_mandatory: input.isMandatory } : {}),
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
        action: 'requirement.updated',
        entityType: 'document_requirement',
        entityId: id,
        metadata: { fields: Object.keys(input) },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const updated = await trx
        .selectFrom('document_requirements')
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
        .selectFrom('document_requirements')
        .select(['doc_type', 'shipment_type'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!existing) throw ApiError.notFound('Document requirement not found');

      await trx.deleteFrom('document_requirements').where('id', '=', id).execute();
      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'requirement.deleted',
        entityType: 'document_requirement',
        entityId: id,
        metadata: { shipmentType: existing.shipment_type, docType: existing.doc_type },
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
  shipment_type: string;
  case_kind: CaseKind | null;
  doc_type: string;
  label: string;
  is_mandatory: boolean;
  sort_order: number;
  is_active: boolean;
  source_url: string | null;
  effective_date: Date | null;
  verification_status: VerificationStatus;
}): RequirementView {
  return {
    id: row.id,
    shipmentType: row.shipment_type as RequirementView['shipmentType'],
    caseKind: row.case_kind,
    docType: row.doc_type,
    label: row.label,
    isMandatory: row.is_mandatory,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    sourceUrl: row.source_url,
    effectiveDate: row.effective_date ? formatDateOnly(row.effective_date) : null,
    verificationStatus: row.verification_status,
  };
}
