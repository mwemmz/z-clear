import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { pino } from 'pino';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware';
import { ApiExceptionsFilter } from '../src/common/errors/api-exceptions.filter';
import { DatabaseService } from '../src/database/database.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { uuidv7 } from '../src/common/ids';

const PASSWORD = 'correct horse battery staple';

/** Tenant-owned registry guidance: provenance, RLS, permissions and audit. */
describe('registry guidance (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const importerA = uuidv7();
  const driverA = uuidv7();
  const ownerB = uuidv7();

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

    await db.withTenant(tenantA, (trx) =>
      trx.insertInto('tenants').values({ id: tenantA, name: 'Guidance Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Guidance Tenant B' }).execute(),
    );
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('users')
        .values([
          {
            id: ownerA,
            tenant_id: tenantA,
            email: `guidance-owner-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'agency_owner',
          },
          {
            id: importerA,
            tenant_id: tenantA,
            email: `guidance-importer-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'client_viewer',
          },
          {
            id: driverA,
            tenant_id: tenantA,
            email: `guidance-driver-a-${tenantA}@example.com`,
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
          email: `guidance-owner-b-${tenantB}@example.com`,
          password_hash: hash,
          role: 'agency_owner',
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

  const ownerToken = () => tokenFor(`guidance-owner-a-${tenantA}@example.com`);
  const importerToken = () => tokenFor(`guidance-importer-a-${tenantA}@example.com`);
  const driverToken = () => tokenFor(`guidance-driver-a-${tenantA}@example.com`);
  const ownerBToken = () => tokenFor(`guidance-owner-b-${tenantB}@example.com`);

  it('starts empty: no official requirement is seeded by the platform', async () => {
    const token = await ownerToken();
    const response = await server()
      .get('/api/v1/guidance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('creates unverified guidance with provenance and an audit entry', async () => {
    const token = await ownerToken();
    const created = await server()
      .post('/api/v1/guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stepKey: 'tpin_registration',
        title: 'TPIN registration',
        detail: 'Agency guidance only; confirm current requirements with ZRA.',
        sortOrder: 1,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      stepKey: 'tpin_registration',
      verificationStatus: 'NEEDS_VERIFICATION',
      isActive: true,
      isVerified: false,
      sourceUrl: null,
    });

    const audit = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select('metadata')
        .where('action', '=', 'guidance.created')
        .where('entity_id', '=', created.body.id)
        .execute(),
    );
    expect(audit).toHaveLength(1);
  });

  it('lets an importer read guidance but denies writes and the driver role', async () => {
    const importer = await importerToken();
    const listed = await server()
      .get('/api/v1/guidance')
      .set('Authorization', `Bearer ${importer}`)
      .expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ verificationStatus: 'NEEDS_VERIFICATION' });

    await server()
      .post('/api/v1/guidance')
      .set('Authorization', `Bearer ${importer}`)
      .send({ stepKey: 'not_allowed', title: 'Not allowed' })
      .expect(403);

    const driver = await driverToken();
    await server().get('/api/v1/guidance').set('Authorization', `Bearer ${driver}`).expect(403);
  });

  it('requires a source before a step can be marked VERIFIED', async () => {
    const token = await ownerToken();
    await server()
      .post('/api/v1/guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stepKey: 'bad_verified',
        title: 'No source',
        verificationStatus: 'VERIFIED',
      })
      .expect(400);

    const created = await server()
      .post('/api/v1/guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stepKey: 'registry_registration',
        title: 'Agents registry',
        verificationStatus: 'VERIFIED',
        sourceUrl: 'https://example.com/agency-guidance',
        effectiveDate: '2026-11-01',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      isVerified: true,
      effectiveDate: '2026-11-01',
      verificationStatus: 'VERIFIED',
    });
  });

  it('updates and removes guidance with an audit entry', async () => {
    const token = await ownerToken();
    const list = await server()
      .get('/api/v1/guidance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const target = (list.body as { stepKey: string; id: string }[]).find(
      (row) => row.stepKey === 'tpin_registration',
    );
    expect(target).toBeDefined();

    const updated = await server()
      .patch(`/api/v1/guidance/${target!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'TPIN setup (agency guidance)', isActive: false })
      .expect(200);
    expect(updated.body).toMatchObject({ isActive: false, isVerified: false });

    const active = await server()
      .get('/api/v1/guidance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (active.body as { stepKey: string }[]).some((row) => row.stepKey === 'tpin_registration'),
    ).toBe(false);

    const all = await server()
      .get('/api/v1/guidance?includeInactive=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (all.body as { stepKey: string }[]).some((row) => row.stepKey === 'tpin_registration'),
    ).toBe(true);

    await server()
      .delete(`/api/v1/guidance/${target!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const audit = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select('action')
        .where('entity_id', '=', target!.id)
        .orderBy('created_at')
        .execute(),
    );
    expect(audit.map((row) => row.action)).toEqual([
      'guidance.created',
      'guidance.updated',
      'guidance.deleted',
    ]);
  });

  it('never exposes one tenant’s guidance to another', async () => {
    const other = await ownerBToken();
    const listed = await server()
      .get('/api/v1/guidance')
      .set('Authorization', `Bearer ${other}`)
      .expect(200);
    expect(listed.body).toEqual([]);

    const token = await ownerToken();
    const own = await server()
      .get('/api/v1/guidance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const id = (own.body as { id: string }[])[0]?.id as string;
    await server()
      .patch(`/api/v1/guidance/${id}`)
      .set('Authorization', `Bearer ${other}`)
      .send({ title: 'Stolen' })
      .expect(404);
  });
});
