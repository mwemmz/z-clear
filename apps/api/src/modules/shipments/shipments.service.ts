import { Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { ShipmentStatus, ShipmentType } from '@zclear/shared';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import type { Role } from '../../common/roles';
import { DatabaseService } from '../../database/database.service';
import type { Database } from '../../database/database.types';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import {
  MATERIAL_SHIPMENT_FIELDS,
  type CreateShipmentInput,
  type ListShipmentsQuery,
  type ShipmentDetail,
  type ShipmentEventSummary,
  type ShipmentSummary,
  type UpdateShipmentInput,
  type UpdateStageInput,
} from './shipments.dto';

const UNIQUE_VIOLATION = '23505';

const SHIPMENT_COLUMNS = [
  'id',
  'reference',
  'client_name',
  'client_contact',
  'type',
  'stage',
  'hold_reason',
  'origin',
  'destination',
  'consignment',
  'importer_user_id',
  'assigned_agent_id',
  'review_freshness',
  'created_at',
  'updated_at',
] as const;

/** Assignment columns can only be set to users of this tenant with these roles. */
const ASSIGNABLE_ROLES = ['client_viewer', 'agent_staff'] as const;

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Lists shipments. A `client_viewer` is additionally restricted to shipments
   * assigned to them as the importer — assignment is enforced server-side, not
   * by hiding links in the UI.
   */
  async list(
    tenantId: string,
    query: ListShipmentsQuery,
    viewer?: { role: Role; userId: string },
  ): Promise<ShipmentSummary[]> {
    const rows = await this.db.withTenant(tenantId, (trx) => {
      let builder = trx
        .selectFrom('shipments')
        .select(SHIPMENT_COLUMNS)
        .where('is_active', '=', true);
      if (viewer?.role === 'client_viewer') {
        builder = builder.where('importer_user_id', '=', viewer.userId);
      }
      if (query.stage) {
        builder = builder.where('stage', '=', query.stage);
      }
      if (query.q) {
        const pattern = `%${query.q}%`;
        builder = builder.where((eb) =>
          eb.or([eb('reference', 'ilike', pattern), eb('client_name', 'ilike', pattern)]),
        );
      }
      return builder
        .orderBy('created_at', 'desc')
        .limit(query.limit)
        .offset(query.offset)
        .execute();
    });
    return rows.map(toSummary);
  }

  /**
   * Fetches one shipment. A `client_viewer` can only read shipments assigned
   * to them; anyone else in the tenant sees all tenant shipments.
   */
  async get(
    tenantId: string,
    id: string,
    viewer?: { role: Role; userId: string },
  ): Promise<ShipmentDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      let builder = trx.selectFrom('shipments').select(SHIPMENT_COLUMNS).where('id', '=', id);
      if (viewer?.role === 'client_viewer') {
        builder = builder.where('importer_user_id', '=', viewer.userId);
      }
      const row = await builder.executeTakeFirst();
      if (!row) throw ApiError.notFound('Shipment not found');
      const events = await trx
        .selectFrom('shipment_events')
        .select(['id', 'from_stage', 'to_stage', 'note', 'source', 'actor_user_id', 'created_at'])
        .where('shipment_id', '=', id)
        .orderBy('created_at', 'asc')
        .execute();
      return { ...toSummary(row), events: events.map(toEventSummary) };
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    input: CreateShipmentInput,
    meta: RequestMeta,
  ): Promise<ShipmentSummary> {
    const id = uuidv7();
    try {
      return await this.db.withTenant(tenantId, async (trx) => {
        await this.assertAssignees(trx, tenantId, input.importerUserId, input.assignedAgentId);
        const row = await trx
          .insertInto('shipments')
          .values({
            id,
            tenant_id: tenantId,
            reference: input.reference,
            client_name: input.clientName,
            client_contact: input.clientContact ?? null,
            type: input.type,
            origin: input.origin ?? null,
            destination: input.destination ?? null,
            consignment: input.consignment ?? {},
            importer_user_id: input.importerUserId ?? null,
            assigned_agent_id: input.assignedAgentId ?? null,
            created_by: actorUserId,
            updated_by: actorUserId,
          })
          .returning(SHIPMENT_COLUMNS)
          .executeTakeFirstOrThrow();

        // The timeline starts at creation so the history is never empty.
        await trx
          .insertInto('shipment_events')
          .values({
            id: uuidv7(),
            tenant_id: tenantId,
            shipment_id: id,
            from_stage: null,
            to_stage: row.stage,
            note: 'Shipment created',
            source: 'system',
            actor_user_id: actorUserId,
          })
          .execute();

        await this.audit.recordInTransaction(trx, {
          tenantId,
          actorUserId,
          action: 'shipment.created',
          entityType: 'shipment',
          entityId: id,
          metadata: { reference: input.reference, type: input.type },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        return toSummary(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict('A shipment with that reference already exists');
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: UpdateShipmentInput,
    meta: RequestMeta,
  ): Promise<ShipmentSummary> {
    try {
      return await this.db.withTenant(tenantId, async (trx) => {
        await this.assertAssignees(trx, tenantId, input.importerUserId, input.assignedAgentId);

        // Material edits bump the freshness counter so an approval raised
        // against the old data is detected as stale. Non-material fields do
        // not bump it.
        const materialFields = MATERIAL_SHIPMENT_FIELDS.filter(
          (field) => input[field] !== undefined,
        );
        const bump = materialFields.length > 0;
        const current = bump
          ? await trx
              .selectFrom('shipments')
              .select('review_freshness')
              .where('id', '=', id)
              .executeTakeFirst()
          : undefined;

        const row = await trx
          .updateTable('shipments')
          .set({
            ...(input.reference !== undefined ? { reference: input.reference } : {}),
            ...(input.clientName !== undefined ? { client_name: input.clientName } : {}),
            ...(input.clientContact !== undefined ? { client_contact: input.clientContact } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.origin !== undefined ? { origin: input.origin } : {}),
            ...(input.destination !== undefined ? { destination: input.destination } : {}),
            ...(input.consignment !== undefined ? { consignment: input.consignment } : {}),
            ...(input.importerUserId !== undefined
              ? { importer_user_id: input.importerUserId }
              : {}),
            ...(input.assignedAgentId !== undefined
              ? { assigned_agent_id: input.assignedAgentId }
              : {}),
            ...(bump && current
              ? { review_freshness: current.review_freshness + 1 }
              : {}),
            updated_by: actorUserId,
            updated_at: new Date(),
          })
          .where('id', '=', id)
          .returning(SHIPMENT_COLUMNS)
          .executeTakeFirst();
        if (!row) throw ApiError.notFound('Shipment not found');

        await this.audit.recordInTransaction(trx, {
          tenantId,
          actorUserId,
          action: 'shipment.updated',
          entityType: 'shipment',
          entityId: id,
          metadata: {
            fields: Object.keys(input),
            ...(bump ? { materialFields, reviewFreshness: row.review_freshness } : {}),
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });

        return toSummary(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict('A shipment with that reference already exists');
      }
      throw error;
    }
  }

  /**
   * Records a manual, one-tap stage change. The stage update, the timeline
   * event and the audit entry are written in a single transaction so they can
   * never disagree. Nothing here talks to ASYCUDA; this is the agent's manual
   * record of where cargo has reached.
   */
  async updateStage(
    tenantId: string,
    actorUserId: string,
    id: string,
    input: UpdateStageInput,
    meta: RequestMeta,
  ): Promise<ShipmentSummary> {
    return this.db.withTenant(tenantId, async (trx) => {
      const current = await trx
        .selectFrom('shipments')
        .select(['stage'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!current) throw ApiError.notFound('Shipment not found');

      const row = await trx
        .updateTable('shipments')
        .set({
          stage: input.stage,
          hold_reason: input.stage === 'on_hold' ? (input.holdReason ?? null) : null,
          updated_by: actorUserId,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returning(SHIPMENT_COLUMNS)
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('shipment_events')
        .values({
          id: uuidv7(),
          tenant_id: tenantId,
          shipment_id: id,
          from_stage: current.stage,
          to_stage: input.stage,
          note: input.note ?? null,
          source: 'manual',
          actor_user_id: actorUserId,
        })
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'shipment.stage_changed',
        entityType: 'shipment',
        entityId: id,
        metadata: { from: current.stage, to: input.stage },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return toSummary(row);
    });
  }

  async listEvents(
    tenantId: string,
    id: string,
    viewer?: { role: Role; userId: string },
  ): Promise<ShipmentEventSummary[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      let builder = trx.selectFrom('shipments').select('id').where('id', '=', id);
      if (viewer?.role === 'client_viewer') {
        builder = builder.where('importer_user_id', '=', viewer.userId);
      }
      const shipment = await builder.executeTakeFirst();
      if (!shipment) throw ApiError.notFound('Shipment not found');
      const events = await trx
        .selectFrom('shipment_events')
        .select(['id', 'from_stage', 'to_stage', 'note', 'source', 'actor_user_id', 'created_at'])
        .where('shipment_id', '=', id)
        .orderBy('created_at', 'asc')
        .execute();
      return events.map(toEventSummary);
    });
  }
  /**
   * Validates that assignees exist, are active, belong to the tenant and have a
   * role allowed for that side of the workflow (importer = client_viewer, agent
   * = agent_staff or above). Throws 400 so cross-tenant ids are not leaked.
   */
  private async assertAssignees(
    trx: Transaction<Database>,
    tenantId: string,
    importerUserId?: string | null,
    assignedAgentId?: string | null,
  ): Promise<void> {
    if (importerUserId !== undefined && importerUserId !== null) {
      const row = await trx
        .selectFrom('users')
        .select(['id', 'role', 'is_active'])
        .where('id', '=', importerUserId)
        .where('tenant_id', '=', tenantId)
        .executeTakeFirst();
      if (!row || !row.is_active) {
        throw ApiError.validation('Importer user not found in this tenant', [
          { field: 'importerUserId', issue: 'must reference an active tenant user' },
        ]);
      }
      if (row.role !== 'client_viewer') {
        throw ApiError.validation('The importer must be a client_viewer user', [
          { field: 'importerUserId', issue: `role '${row.role}' cannot be an importer` },
        ]);
      }
    }
    if (assignedAgentId !== undefined && assignedAgentId !== null) {
      const row = await trx
        .selectFrom('users')
        .select(['id', 'role', 'is_active'])
        .where('id', '=', assignedAgentId)
        .where('tenant_id', '=', tenantId)
        .executeTakeFirst();
      if (!row || !row.is_active) {
        throw ApiError.validation('Assigned agent not found in this tenant', [
          { field: 'assignedAgentId', issue: 'must reference an active tenant user' },
        ]);
      }
      if (!(ASSIGNABLE_ROLES as readonly string[]).includes(row.role)) {
        throw ApiError.validation('The assigned agent must be agent staff or an owner', [
          { field: 'assignedAgentId', issue: `role '${row.role}' cannot own reviews` },
        ]);
      }
    }
  }

}

function toSummary(row: {
  id: string;
  reference: string;
  client_name: string;
  client_contact: string | null;
  type: ShipmentType;
  stage: ShipmentStatus;
  hold_reason: string | null;
  origin: string | null;
  destination: string | null;
  consignment: Record<string, unknown>;
  importer_user_id: string | null;
  assigned_agent_id: string | null;
  review_freshness: number;
  created_at: Date;
  updated_at: Date;
}): ShipmentSummary {
  return {
    id: row.id,
    reference: row.reference,
    clientName: row.client_name,
    clientContact: row.client_contact,
    type: row.type,
    stage: row.stage,
    holdReason: row.hold_reason,
    origin: row.origin,
    destination: row.destination,
    consignment: row.consignment ?? {},
    importerUserId: row.importer_user_id,
    assignedAgentId: row.assigned_agent_id,
    reviewFreshness: row.review_freshness,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toEventSummary(row: {
  id: string;
  from_stage: ShipmentStatus | null;
  to_stage: ShipmentStatus;
  note: string | null;
  source: string;
  actor_user_id: string | null;
  created_at: Date;
}): ShipmentEventSummary {
  return {
    id: row.id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    note: row.note,
    source: row.source,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}
