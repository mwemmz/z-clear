import { Injectable } from '@nestjs/common';
import { uuidv7 } from '../../common/ids';
import type { RequestMeta } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { ShipmentsService } from '../shipments/shipments.service';
import type { CaseSummary, CreateCaseInput } from './cases.dto';

/**
 * Importer-owned case creation. Reuses the shipment write path so a case gets
 * the same timeline, audit row and RLS protections as an agent-created
 * shipment; the only new rule is that the actor becomes the importer on the
 * case. No agent can be chosen yet — appointment is a later, consented step.
 */
@Injectable()
export class CasesService {
  constructor(
    private readonly shipments: ShipmentsService,
    private readonly audit: AuditService,
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
}
