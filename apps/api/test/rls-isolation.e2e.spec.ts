import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'kysely';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { uuidv7 } from '../src/common/ids';

/**
 * Runs against the non-owner application role, so PostgreSQL Row-Level
 * Security is genuinely enforced rather than bypassed by table ownership.
 */
describe('row-level security (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const userA = uuidv7();
  const userB = uuidv7();
  const emailA = `a-${tenantA}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    db = app.get(DatabaseService);

    await db.withTenant(tenantA, (trx) =>
      trx.insertInto('tenants').values({ id: tenantA, name: 'Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Tenant B' }).execute(),
    );
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('users')
        .values({
          id: userA,
          tenant_id: tenantA,
          email: emailA,
          password_hash: 'not-a-real-hash',
          role: 'agency_owner',
        })
        .execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx
        .insertInto('users')
        .values({
          id: userB,
          tenant_id: tenantB,
          email: `b-${tenantB}@example.com`,
          password_hash: 'not-a-real-hash',
          role: 'agency_owner',
        })
        .execute(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('scopes reads to the active tenant', async () => {
    const rows = await db.withTenant(tenantA, (trx) =>
      trx.selectFrom('users').select('id').execute(),
    );
    expect(rows.map((row) => row.id)).toEqual([userA]);
  });

  it('returns nothing when no tenant is set (fail closed)', async () => {
    const rows = await db.kysely.selectFrom('users').select('id').execute();
    expect(rows).toEqual([]);
  });

  it('cannot read another tenant even when queried explicitly', async () => {
    const rows = await db.withTenant(tenantA, (trx) =>
      trx.selectFrom('users').select('id').where('tenant_id', '=', tenantB).execute(),
    );
    expect(rows).toEqual([]);
  });

  it('rejects cross-tenant writes', async () => {
    await expect(
      db.withTenant(tenantA, (trx) =>
        trx
          .insertInto('users')
          .values({
            id: uuidv7(),
            tenant_id: tenantB,
            email: `sneaky-${uuidv7()}@example.com`,
            password_hash: 'not-a-real-hash',
            role: 'agent_staff',
          })
          .execute(),
      ),
    ).rejects.toThrow();
  });

  it('supports login lookup before a tenant is known', async () => {
    const { rows } = await sql<{ id: string }>`
      select id from auth_login_lookup(${emailA})
    `.execute(db.kysely);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(userA);
  });

  it('keeps audit_logs append-only', async () => {
    const id = uuidv7();
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('audit_logs')
        .values({ id, tenant_id: tenantA, action: 'test.action' })
        .execute(),
    );

    await expect(
      db.withTenant(tenantA, (trx) =>
        trx.updateTable('audit_logs').set({ action: 'tampered' }).where('id', '=', id).execute(),
      ),
    ).rejects.toThrow(/append-only/);

    await expect(
      db.withTenant(tenantA, (trx) => trx.deleteFrom('audit_logs').where('id', '=', id).execute()),
    ).rejects.toThrow(/append-only/);
  });
});
