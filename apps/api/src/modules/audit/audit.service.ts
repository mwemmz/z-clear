import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { uuidv7 } from '../../common/ids';

export interface AuditEntry {
  tenantId: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Writes to the append-only audit_logs table. The table has a database trigger
 * that rejects UPDATE/DELETE, so history cannot be rewritten even by the app
 * role. Writes run inside the tenant transaction so RLS is satisfied.
 */
@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.withTenant(entry.tenantId, (trx) =>
      trx
        .insertInto('audit_logs')
        .values({
          id: uuidv7(),
          tenant_id: entry.tenantId,
          actor_user_id: entry.actorUserId ?? null,
          action: entry.action,
          entity_type: entry.entityType ?? null,
          entity_id: entry.entityId ?? null,
          metadata: entry.metadata ?? {},
          ip: entry.ip ?? null,
          user_agent: entry.userAgent ?? null,
        })
        .execute(),
    );
  }
}
