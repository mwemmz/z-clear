import { Injectable } from '@nestjs/common';
import type { ShipmentStatus, ShipmentType } from '@zclear/shared';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import type {
  CreateShipmentInput,
  ListShipmentsQuery,
  ShipmentDetail,
  ShipmentEventSummary,
  ShipmentSummary,
  UpdateShipmentInput,
  UpdateStageInput,
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
  'created_at',
  'updated_at',
] as const;

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ListShipmentsQuery): Promise<ShipmentSummary[]> {
    const rows = await this.db.withTenant(tenantId, (trx) => {
      let builder = trx
        .selectFrom('shipments')
        .select(SHIPMENT_COLUMNS)
        .where('is_active', '=', true);
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

  async get(tenantId: string, id: string): Promise<ShipmentDetail> {
    return this.db.withTenant(tenantId, async (trx) => {
      const row = await trx
        .selectFrom('shipments')
        .select(SHIPMENT_COLUMNS)
        .where('id', '=', id)
        .executeTakeFirst();
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
          metadata: { fields: Object.keys(input) },
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

  async listEvents(tenantId: string, id: string): Promise<ShipmentEventSummary[]> {
    return this.db.withTenant(tenantId, async (trx) => {
      const shipment = await trx
        .selectFrom('shipments')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst();
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
