import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
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
  'doc_type',
  'label',
  'is_mandatory',
  'sort_order',
  'is_active',
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
      const rows = await builder.orderBy('shipment_type').orderBy('sort_order').execute();
      return rows.map((row) => ({
        id: row.id,
        shipmentType: row.shipment_type,
        docType: row.doc_type,
        label: row.label,
        isMandatory: row.is_mandatory,
        sortOrder: row.sort_order,
        isActive: row.is_active,
      }));
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
        .where('doc_type', '=', input.docType)
        .executeTakeFirst();
      if (duplicate) {
        throw ApiError.conflict('That document type is already configured for this shipment type');
      }

      const id = uuidv7();
      await trx
        .insertInto('document_requirements')
        .values({
          id,
          tenant_id: tenantId,
          shipment_type: input.shipmentType,
          doc_type: input.docType,
          label: input.label,
          is_mandatory: input.isMandatory,
          sort_order: input.sortOrder,
          is_active: true,
        })
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'requirement.created',
        entityType: 'document_requirement',
        entityId: id,
        metadata: { shipmentType: input.shipmentType, docType: input.docType },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return {
        id,
        shipmentType: input.shipmentType,
        docType: input.docType,
        label: input.label,
        isMandatory: input.isMandatory,
        sortOrder: input.sortOrder,
        isActive: true,
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

      return {
        id: existing.id,
        shipmentType: existing.shipment_type,
        docType: existing.doc_type,
        label: input.label ?? existing.label,
        isMandatory: input.isMandatory ?? existing.is_mandatory,
        sortOrder: input.sortOrder ?? existing.sort_order,
        isActive: input.isActive ?? existing.is_active,
      };
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
