import { Injectable } from '@nestjs/common';
import { caseConsignmentSchema, personaliseChecklist } from '@zclear/shared';
import { formatDateOnly } from '../../common/dates';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import type { RequestMeta } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { ShipmentsService } from '../shipments/shipments.service';
import type { CaseChecklist, CaseSummary, CreateCaseInput } from './cases.dto';

/**
 * Importer-owned case reads and writes. Creation reuses the shipment write
 * path so a case gets the same timeline, audit row and RLS protections as an
 * agent-created shipment; the only new rule is that the actor becomes the
 * importer on the case. No agent can be chosen yet — appointment is a later,
 * consented step.
 */
@Injectable()
export class CasesService {
  constructor(
    private readonly shipments: ShipmentsService,
    private readonly audit: AuditService,
    private readonly db: DatabaseService,
  ) {}

  async create(
    tenantId: string,
    actorUserId: string,
    input: CreateCaseInput,
    meta: RequestMeta,
  ): Promise<CaseSummary> {
    const consignment = input.consignment as unknown as Record<string, unknown>;
    const details =
      input.consignment.caseKind === 'vehicle'
        ? input.consignment.vehicle
        : input.consignment.goods;
    const summary = await this.shipments.create(
      tenantId,
      actorUserId,
      {
        reference: `CASE-${uuidv7().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        clientName: input.clientName,
        clientContact: input.clientContact,
        type: 'import',
        origin: details.origin,
        destination: details.portOfEntry,
        consignment,
        importerUserId: actorUserId,
      },
      meta,
    );

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'case.created',
      entityType: 'shipment',
      entityId: summary.id,
      metadata: { caseKind: input.consignment.caseKind, reference: summary.reference },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return summary;
  }

  /**
   * Personalised checklist for the caller's own case. Rules come from the
   * tenant's config and are filtered by case kind in a pure helper. Any rule
   * without a VERIFIED source is labelled by the UI; we never present agency
   * guidance as an official ZRA requirement.
   */
  async checklist(tenantId: string, actorUserId: string, caseId: string): Promise<CaseChecklist> {
    return this.db.withTenant(tenantId, async (trx) => {
      const shipment = await trx
        .selectFrom('shipments')
        .select(['id', 'type', 'consignment', 'importer_user_id'])
        .where('id', '=', caseId)
        .where('is_active', '=', true)
        .executeTakeFirst();
      if (!shipment || shipment.importer_user_id !== actorUserId) {
        // Same response for missing and someone else's case: no existence leak.
        throw ApiError.notFound('Case not found');
      }

      const parsed = caseConsignmentSchema.safeParse(shipment.consignment);
      if (!parsed.success) {
        throw ApiError.conflict(
          'This case has no typed consignment, so its checklist cannot be personalised',
        );
      }

      const [ruleRows, documentRows] = await Promise.all([
        trx
          .selectFrom('document_requirements')
          .select([
            'doc_type',
            'label',
            'is_mandatory',
            'sort_order',
            'case_kind',
            'source_url',
            'effective_date',
            'verification_status',
          ])
          .where('shipment_type', '=', shipment.type)
          .where('is_active', '=', true)
          .execute(),
        trx
          .selectFrom('documents')
          .select('doc_type')
          .where('shipment_id', '=', caseId)
          .where('status', '!=', 'rejected')
          .execute(),
      ]);

      const satisfied = new Set(documentRows.map((row) => row.doc_type));
      return personaliseChecklist(
        ruleRows.map((row) => ({
          docType: row.doc_type,
          label: row.label,
          isMandatory: row.is_mandatory,
          sortOrder: row.sort_order,
          caseKind: row.case_kind,
          sourceUrl: row.source_url,
          effectiveDate: row.effective_date ? formatDateOnly(row.effective_date) : null,
          verificationStatus: row.verification_status,
          satisfied: satisfied.has(row.doc_type),
        })),
        parsed.data.caseKind,
      );
    });
  }
}
