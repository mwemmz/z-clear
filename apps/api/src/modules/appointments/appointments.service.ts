import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import type {
  AgentDirectoryEntry,
  AgentProfileView,
  AppointAgentInput,
  AppointmentResult,
  CreateAgentProfileInput,
} from './appointments.dto';

interface DirectoryRow {
  id: string;
  tenant_id: string;
  user_id: string;
  agency_name: string;
  location: string;
  service_area: string | null;
  languages: string | null;
  licence_status: 'SIMULATED' | 'VERIFIED';
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The one deliberate cross-tenant read. It goes through a SECURITY DEFINER
   * function that returns only published, curated columns — never email,
   * TPIN, documents or assessments.
   */
  async listDirectory(): Promise<AgentDirectoryEntry[]> {
    const { rows } = await sql<DirectoryRow>`select * from published_agent_directory()`.execute(
      this.db.kysely,
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      agencyName: row.agency_name,
      location: row.location,
      serviceArea: row.service_area,
      languages: row.languages,
      licenceStatus: row.licence_status,
      licenceNotice: 'Simulated, pending ZRA API',
    }));
  }

  /** An agency publishes or updates its own directory card. */
  async upsertProfile(
    tenantId: string,
    actorUserId: string,
    input: CreateAgentProfileInput,
    meta: RequestMeta,
  ): Promise<AgentProfileView> {
    return this.db.withTenant(tenantId, async (trx) => {
      const id = uuidv7();
      await trx
        .insertInto('agent_profiles')
        .values({
          id,
          tenant_id: tenantId,
          user_id: actorUserId,
          agency_name: input.agencyName,
          location: input.location,
          service_area: input.serviceArea ?? null,
          languages: input.languages ?? null,
          notes: input.notes ?? null,
          is_published: true,
        })
        .onConflict((oc) =>
          oc.column('user_id').doUpdateSet({
            agency_name: input.agencyName,
            location: input.location,
            service_area: input.serviceArea ?? null,
            languages: input.languages ?? null,
            notes: input.notes ?? null,
            is_published: true,
            updated_at: new Date(),
          }),
        )
        .execute();

      await this.audit.recordInTransaction(trx, {
        tenantId,
        actorUserId,
        action: 'agent_profile.published',
        entityType: 'agent_profile',
        entityId: id,
        metadata: { agencyName: input.agencyName },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      const row = await trx
        .selectFrom('agent_profiles')
        .select([
          'id',
          'agency_name',
          'location',
          'service_area',
          'languages',
          'notes',
          'is_published',
          'licence_status',
        ])
        .where('user_id', '=', actorUserId)
        .executeTakeFirstOrThrow();

      return {
        id: row.id,
        agencyName: row.agency_name,
        location: row.location,
        serviceArea: row.service_area,
        languages: row.languages,
        notes: row.notes,
        isPublished: row.is_published,
        licenceStatus: row.licence_status,
      };
    });
  }

  /**
   * Consented transfer into the agency tenant. The database function performs
   * all validation and writes its own dual-tenant audit rows in the same
   * transaction, so there is no partial state on a failed appointment.
   */
  async appoint(
    tenantId: string,
    actorUserId: string,
    input: AppointAgentInput,
  ): Promise<AppointmentResult> {
    try {
      const agencyTenantId = await this.db.withTenantAsUser(tenantId, actorUserId, async (trx) => {
        const { rows } = await sql<{ appoint_agent: string }>`
          select appoint_agent(
            ${uuidv7()}::uuid,
            ${uuidv7()}::uuid,
            ${uuidv7()}::uuid,
            ${input.caseId}::uuid,
            ${input.agentUserId}::uuid,
            ${input.consentText}
          ) as appoint_agent
        `.execute(trx);
        const result = rows[0];
        if (!result) throw new Error('appointment did not return a tenant');
        return result.appoint_agent;
      });
      return { agencyTenantId, mustReauthenticate: true };
    } catch (error) {
      throw toAppointmentError(error);
    }
  }
}

function toAppointmentError(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('case not found')) {
    return ApiError.notFound('Case not found');
  }
  if (message.includes('only the importer')) {
    return ApiError.forbidden('Only the importer on this case may appoint an agent');
  }
  if (message.includes('already has an assigned agent')) {
    return ApiError.conflict('This case already has an assigned agent');
  }
  return ApiError.validation('Appointment could not be completed', [
    { field: 'appointment', issue: message || 'validation failed' },
  ]);
}
