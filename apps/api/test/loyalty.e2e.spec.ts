import { PROGRAM_NOT_CONFIGURED_NOTICE } from '@zclear/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { pino } from 'pino';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware';
import { ApiExceptionsFilter } from '../src/common/errors/api-exceptions.filter';
import { uuidv7 } from '../src/common/ids';
import { DatabaseService } from '../src/database/database.service';
import { PasswordService } from '../src/modules/auth/password.service';

const PASSWORD = 'correct horse battery staple';

describe('loyalty structure (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const importerA = uuidv7();
  const otherA = uuidv7();
  const driverA = uuidv7();
  const ownerB = uuidv7();
  const pointsConfig = uuidv7();
  const referralConfig = uuidv7();
  const ownEntryOld = uuidv7();
  const ownEntryNew = uuidv7();
  const otherEntry = uuidv7();
  const otherTenantEntry = uuidv7();
  const ownReferral = uuidv7();
  const otherReferral = uuidv7();
  const otherTenantReferral = uuidv7();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new ApiExceptionsFilter(pino({ level: 'silent' })));
    await app.init();

    db = app.get(DatabaseService);
    const hash = await app.get(PasswordService).hash(PASSWORD);

    for (const [id, name] of [
      [tenantA, 'Loyalty Tenant A'],
      [tenantB, 'Loyalty Tenant B'],
    ] as const) {
      await db.withTenant(id, (trx) => trx.insertInto('tenants').values({ id, name }).execute());
    }

    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('users')
        .values([
          {
            id: ownerA,
            tenant_id: tenantA,
            email: `loyalty-owner-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'agency_owner',
          },
          {
            id: importerA,
            tenant_id: tenantA,
            email: `loyalty-importer-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'client_viewer',
          },
          {
            id: otherA,
            tenant_id: tenantA,
            email: `loyalty-other-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'client_viewer',
          },
          {
            id: driverA,
            tenant_id: tenantA,
            email: `loyalty-driver-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'driver',
          },
        ])
        .execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx
        .insertInto('users')
        .values({
          id: ownerB,
          tenant_id: tenantB,
          email: `loyalty-owner-b-${tenantB}@example.com`,
          password_hash: hash,
          role: 'agency_owner',
        })
        .execute(),
    );

    // Test-only rules. No product config, reward value or referral incentive is
    // seeded; these rows exist solely to prove tenant and user scoping.
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('loyalty_program_config')
        .values([
          {
            id: pointsConfig,
            tenant_id: tenantA,
            program_type: 'points',
            version: 1,
            verification_status: 'VERIFIED',
            rules: { eventCodes: ['test.event'] },
            source_note: 'Synthetic test rule; not product data.',
            configured_at: new Date('2026-01-01T00:00:00Z'),
            created_by: ownerA,
          },
          {
            id: referralConfig,
            tenant_id: tenantA,
            program_type: 'referrals',
            version: 1,
            verification_status: 'VERIFIED',
            rules: { states: ['recorded'] },
            source_note: 'Synthetic test rule; not product data.',
            configured_at: new Date('2026-01-01T00:00:00Z'),
            created_by: ownerA,
          },
        ])
        .execute(),
    );

    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('point_ledger_entries')
        .values([
          {
            id: ownEntryOld,
            tenant_id: tenantA,
            user_id: importerA,
            source_type: 'configured_event',
            reason_code: 'test.event',
            source_id: uuidv7(),
            points: 3,
            created_at: new Date('2026-01-01T00:00:00Z'),
          },
          {
            id: ownEntryNew,
            tenant_id: tenantA,
            user_id: importerA,
            source_type: 'manual_adjustment',
            reason_code: 'test.adjustment',
            source_id: null,
            points: 4,
            created_at: new Date('2026-01-02T00:00:00Z'),
          },
          {
            id: otherEntry,
            tenant_id: tenantA,
            user_id: otherA,
            source_type: 'configured_event',
            reason_code: 'test.event',
            source_id: uuidv7(),
            points: 99,
          },
        ])
        .execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx
        .insertInto('point_ledger_entries')
        .values({
          id: otherTenantEntry,
          tenant_id: tenantB,
          user_id: ownerB,
          source_type: 'configured_event',
          reason_code: 'test.event',
          source_id: uuidv7(),
          points: 99,
        })
        .execute(),
    );

    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('referral_records')
        .values([
          {
            id: ownReferral,
            tenant_id: tenantA,
            referrer_user_id: importerA,
            state: 'recorded',
            created_at: new Date('2026-01-01T00:00:00Z'),
          },
          {
            id: otherReferral,
            tenant_id: tenantA,
            referrer_user_id: otherA,
            state: 'recorded',
          },
        ])
        .execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx
        .insertInto('referral_records')
        .values({
          id: otherTenantReferral,
          tenant_id: tenantB,
          referrer_user_id: ownerB,
          state: 'recorded',
        })
        .execute(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  const server = () => request(app.getHttpServer());
  const tokens = new Map<string, string>();

  async function tokenFor(email: string): Promise<string> {
    const cached = tokens.get(email);
    if (cached) return cached;
    const response = await server()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const token = response.body.accessToken as string;
    tokens.set(email, token);
    return token;
  }

  it('returns unconfigured programmes with null balances and no invented claims', async () => {
    const token = await tokenFor(`loyalty-owner-b-${tenantB}@example.com`);

    const points = await server()
      .get('/api/v1/points/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(points.body.program).toEqual({
      version: 0,
      verificationStatus: 'NEEDS_VERIFICATION',
      configuredAt: null,
      notice: PROGRAM_NOT_CONFIGURED_NOTICE,
    });
    expect(points.body.balance).toBeNull();
    expect(points.body.ledger).toEqual([]);

    const referrals = await server()
      .get('/api/v1/referrals/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(referrals.body.program.version).toBe(0);
    expect(referrals.body.program.notice).toBe(PROGRAM_NOT_CONFIGURED_NOTICE);
    expect(referrals.body.records).toEqual([]);

    const ledger = await server()
      .get('/api/v1/points/ledger')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(ledger.body).toEqual([]);
  });

  it('denies loyalty reads to drivers', async () => {
    const token = await tokenFor(`loyalty-driver-a-${tenantA}@example.com`);
    await server().get('/api/v1/points/me').set('Authorization', `Bearer ${token}`).expect(403);
    await server().get('/api/v1/points/ledger').set('Authorization', `Bearer ${token}`).expect(403);
    await server().get('/api/v1/referrals/me').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('rejects invalid ledger pagination', async () => {
    const token = await tokenFor(`loyalty-owner-a-${tenantA}@example.com`);
    await server()
      .get('/api/v1/points/ledger')
      .query({ limit: '0' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('scopes configured points and referrals to the current user and tenant', async () => {
    const token = await tokenFor(`loyalty-importer-a-${tenantA}@example.com`);

    const points = await server()
      .get('/api/v1/points/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(points.body.program.verificationStatus).toBe('VERIFIED');
    expect(points.body.balance).toBe(7);
    expect(points.body.ledger.map((entry: { id: string }) => entry.id)).toEqual([
      ownEntryNew,
      ownEntryOld,
    ]);
    expect(JSON.stringify(points.body)).not.toContain(otherEntry);
    expect(JSON.stringify(points.body)).not.toContain(otherTenantEntry);

    const ledger = await server()
      .get('/api/v1/points/ledger')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(ledger.body.map((entry: { id: string }) => entry.id)).toEqual([
      ownEntryNew,
      ownEntryOld,
    ]);

    const referrals = await server()
      .get('/api/v1/referrals/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(referrals.body.records.map((record: { id: string }) => record.id)).toEqual([
      ownReferral,
    ]);
    expect(JSON.stringify(referrals.body)).not.toContain(otherReferral);
    expect(JSON.stringify(referrals.body)).not.toContain(otherTenantReferral);
  });

  it('isolates loyalty rows through tenant RLS', async () => {
    const crossTenantRows = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('point_ledger_entries')
        .select('id')
        .where('tenant_id', '=', tenantB)
        .execute(),
    );
    expect(crossTenantRows).toEqual([]);

    const noTenantRows = await db.kysely.selectFrom('point_ledger_entries').select('id').execute();
    expect(noTenantRows).toEqual([]);

    await expect(
      db.withTenant(tenantA, (trx) =>
        trx
          .insertInto('referral_records')
          .values({
            id: uuidv7(),
            tenant_id: tenantB,
            referrer_user_id: ownerB,
            state: 'recorded',
          })
          .execute(),
      ),
    ).rejects.toThrow();
  });

  it('keeps ledger and referral records append-only', async () => {
    await expect(
      db.withTenant(tenantA, (trx) =>
        trx
          .updateTable('point_ledger_entries')
          .set({ points: 999 })
          .where('id', '=', ownEntryOld)
          .execute(),
      ),
    ).rejects.toThrow();

    await expect(
      db.withTenant(tenantA, (trx) =>
        trx.deleteFrom('referral_records').where('id', '=', ownReferral).execute(),
      ),
    ).rejects.toThrow();
  });
});
