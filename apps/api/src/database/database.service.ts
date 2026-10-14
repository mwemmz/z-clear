import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { sql, type Kysely, type Transaction } from 'kysely';
import { KYSELY } from './database.tokens';
import type { Database } from './database.types';

/**
 * Thin data-access entry point. Every tenant-scoped query MUST go through
 * `withTenant`, which opens a transaction and sets `app.tenant_id` so the
 * PostgreSQL Row-Level Security policies apply. This is the second isolation
 * layer behind application-level `(tenant_id, id)` scoping.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database> | null) {}

  get configured(): boolean {
    return this.db !== null;
  }

  get kysely(): Kysely<Database> {
    if (!this.db) {
      throw new Error('Database is not configured: set DATABASE_URL');
    }
    return this.db;
  }

  async withTenant<T>(
    tenantId: string,
    fn: (trx: Transaction<Database>) => Promise<T>,
  ): Promise<T> {
    return this.kysely.transaction().execute(async (trx) => {
      await sql`select set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      return fn(trx);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.db?.destroy();
  }
}
