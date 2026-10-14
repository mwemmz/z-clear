import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.service';
import type { TenantSummary, UpdateTenantInput } from './tenants.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async getCurrent(tenantId: string): Promise<TenantSummary> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('tenants')
        .select(['id', 'name', 'is_active'])
        .where('id', '=', tenantId)
        .executeTakeFirst(),
    );
    if (!row) throw ApiError.notFound('Tenant not found');
    return { id: row.id, name: row.name, isActive: row.is_active };
  }

  async update(
    tenantId: string,
    actorUserId: string,
    input: UpdateTenantInput,
    meta: RequestMeta,
  ): Promise<TenantSummary> {
    const row = await this.db.withTenant(tenantId, (trx) =>
      trx
        .updateTable('tenants')
        .set({ name: input.name, updated_at: new Date() })
        .where('id', '=', tenantId)
        .returning(['id', 'name', 'is_active'])
        .executeTakeFirst(),
    );
    if (!row) throw ApiError.notFound('Tenant not found');

    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'tenant.updated',
      entityType: 'tenant',
      entityId: tenantId,
      metadata: { name: input.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id: row.id, name: row.name, isActive: row.is_active };
  }
}
