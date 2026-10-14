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

describe('shipments (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const staffA = uuidv7();
  const viewerA = uuidv7();
  const ownerB = uuidv7();
  const ownerAEmail = `owner-a-${tenantA}@example.com`;
  const staffAEmail = `staff-a-${tenantA}@example.com`;
  const viewerAEmail = `viewer-a-${tenantA}@example.com`;
  const ownerBEmail = `owner-b-${tenantB}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new ApiExceptionsFilter(pino({ level: 'silent' })));
    await app.init();

    db = app.get(DatabaseService);
    const passwords = app.get(PasswordService);
    const hash = await passwords.hash(PASSWORD);

    await db.withTenant(tenantA, (trx) =>
      trx.insertInto('tenants').values({ id: tenantA, name: 'Shipments Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Shipments Tenant B' }).execute(),
    );
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('users')
        .values([
          {
            id: ownerA,
            tenant_id: tenantA,
            email: ownerAEmail,
            password_hash: hash,
            role: 'agency_owner',
          },
          {
            id: staffA,
            tenant_id: tenantA,
            email: staffAEmail,
            password_hash: hash,
            role: 'agent_staff',
          },
          {
            id: viewerA,
            tenant_id: tenantA,
            email: viewerAEmail,
            password_hash: hash,
            role: 'client_viewer',
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
          email: ownerBEmail,
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

  // Login is rate-limited to 10/min per IP, so tokens are fetched once per user.
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

  function createShipment(token: string, overrides: Record<string, unknown> = {}): request.Test {
    return server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reference: `REF-${uuidv7()}`,
        clientName: 'Kafue Metals Ltd',
        type: 'import',
        ...overrides,
      });
  }

  it('creates a shipment and starts its timeline', async () => {
    const token = await tokenFor(ownerAEmail);
    const created = await createShipment(token, { reference: 'REF-CREATE' }).expect(201);
    expect(created.body).toMatchObject({
      reference: 'REF-CREATE',
      stage: 'docs_received',
      type: 'import',
    });

    const detail = await server()
      .get(`/api/v1/shipments/${created.body.id as string}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.events).toHaveLength(1);
    expect(detail.body.events[0]).toMatchObject({
      fromStage: null,
      toStage: 'docs_received',
      source: 'system',
    });
  });

  it('rejects a duplicate reference within a tenant but allows it across tenants', async () => {
    const ownerAToken = await tokenFor(ownerAEmail);
    await createShipment(ownerAToken, { reference: 'REF-DUP' }).expect(201);
    await createShipment(ownerAToken, { reference: 'REF-DUP' }).expect(409);

    const ownerBToken = await tokenFor(ownerBEmail);
    await createShipment(ownerBToken, { reference: 'REF-DUP' }).expect(201);
  });

  it('records a one-tap stage change with an event and an audit entry', async () => {
    const token = await tokenFor(ownerAEmail);
    const created = await createShipment(token).expect(201);
    const id = created.body.id as string;

    const updated = await server()
      .post(`/api/v1/shipments/${id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'submitted', note: 'Declaration lodged' })
      .expect(200);
    expect(updated.body.stage).toBe('submitted');

    const events = await server()
      .get(`/api/v1/shipments/${id}/events`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(events.body).toHaveLength(2);
    expect(events.body[1]).toMatchObject({
      fromStage: 'docs_received',
      toStage: 'submitted',
      source: 'manual',
      actorUserId: ownerA,
    });

    const audit = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select(['action', 'entity_id'])
        .where('action', '=', 'shipment.stage_changed')
        .where('entity_id', '=', id)
        .execute(),
    );
    expect(audit).toHaveLength(1);
  });

  it('requires a reason to go on hold and clears it when leaving hold', async () => {
    const token = await tokenFor(ownerAEmail);
    const created = await createShipment(token).expect(201);
    const id = created.body.id as string;

    await server()
      .post(`/api/v1/shipments/${id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'on_hold' })
      .expect(400);

    const onHold = await server()
      .post(`/api/v1/shipments/${id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'on_hold', holdReason: 'Awaiting import permit' })
      .expect(200);
    expect(onHold.body).toMatchObject({ stage: 'on_hold', holdReason: 'Awaiting import permit' });

    const released = await server()
      .post(`/api/v1/shipments/${id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'submitted' })
      .expect(200);
    expect(released.body).toMatchObject({ stage: 'submitted', holdReason: null });
  });

  it('rejects an unknown stage with a validation error', async () => {
    const token = await tokenFor(ownerAEmail);
    const created = await createShipment(token).expect(201);
    await server()
      .post(`/api/v1/shipments/${created.body.id as string}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'teleported' })
      .expect(400);
  });

  it('enforces least privilege: viewers read but cannot create or update stages', async () => {
    const ownerToken = await tokenFor(ownerAEmail);
    const viewerToken = await tokenFor(viewerAEmail);
    const staffToken = await tokenFor(staffAEmail);
    const created = await createShipment(ownerToken).expect(201);

    await server()
      .get('/api/v1/shipments')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    await createShipment(viewerToken).expect(403);
    await server()
      .post(`/api/v1/shipments/${created.body.id as string}/stage`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ stage: 'submitted' })
      .expect(403);

    await createShipment(staffToken).expect(201);
    await server()
      .post(`/api/v1/shipments/${created.body.id as string}/stage`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ stage: 'submitted' })
      .expect(200);
  });

  it('isolates shipments between tenants', async () => {
    const ownerAToken = await tokenFor(ownerAEmail);
    const ownerBToken = await tokenFor(ownerBEmail);
    const created = await createShipment(ownerAToken).expect(201);
    const id = created.body.id as string;

    const bList = await server()
      .get('/api/v1/shipments')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(bList.body.map((row: { id: string }) => row.id)).not.toContain(id);

    await server()
      .get(`/api/v1/shipments/${id}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    await server()
      .post(`/api/v1/shipments/${id}/stage`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ stage: 'submitted' })
      .expect(404);
  });

  it('keeps the shipment timeline append-only', async () => {
    const token = await tokenFor(ownerAEmail);
    const created = await createShipment(token).expect(201);
    const id = created.body.id as string;

    await expect(
      db.withTenant(tenantA, (trx) =>
        trx
          .updateTable('shipment_events')
          .set({ note: 'tampered' })
          .where('shipment_id', '=', id)
          .execute(),
      ),
    ).rejects.toThrow(/append-only/);
  });
});
