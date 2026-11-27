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

describe('handoff export (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const viewerA = uuidv7();
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
      trx.insertInto('tenants').values({ id: tenantA, name: 'Handoff Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Handoff Tenant B' }).execute(),
    );
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('users')
        .values([
          {
            id: ownerA,
            tenant_id: tenantA,
            email: `handoff-owner-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'agency_owner',
          },
          {
            id: viewerA,
            tenant_id: tenantA,
            email: `handoff-viewer-a-${tenantA}@example.com`,
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
          email: `handoff-owner-b-${tenantB}@example.com`,
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

  async function tokenFor(email: string, password = PASSWORD): Promise<string> {
    const cached = tokens.get(email);
    if (cached) return cached;
    const response = await server()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token = response.body.accessToken as string;
    tokens.set(email, token);
    return token;
  }

  const ownerToken = () => tokenFor(`handoff-owner-a-${tenantA}@example.com`);
  const viewerToken = () => tokenFor(`handoff-viewer-a-${tenantA}@example.com`);
  const ownerBToken = () => tokenFor(`handoff-owner-b-${tenantB}@example.com`);

  async function newShipment(token: string, reference = `HAND-${uuidv7()}`): Promise<string> {
    const response = await server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ reference, clientName: 'Kafue Metals Ltd', type: 'import' })
      .expect(201);
    return response.body.id as string;
  }

  it('creates a stable artifact with shipment data and stage events', async () => {
    const token = await ownerToken();
    const id = await newShipment(token);
    await server()
      .post(`/api/v1/shipments/${id}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stage: 'submitted' })
      .expect(200);

    const response = await server()
      .post(`/api/v1/shipments/${id}/handoff-export`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.schemaVersion).toBe('zclear.handoff.v1');
    expect(response.body.shipment.reference).toBeTruthy();
    expect(response.body.shipment.clientName).toBe('Kafue Metals Ltd');
    expect(response.body.shipment.stage).toBe('submitted');
    expect(response.body.events.map((event: { toStage: string }) => event.toStage)).toContain(
      'submitted',
    );
    expect(response.body.invoice).toBeNull();
    expect(response.body.notes[0]).toContain('ASYCUDA World');
  });

  it('writes an audit entry for the export', async () => {
    const token = await ownerToken();
    const id = await newShipment(token);
    await server()
      .post(`/api/v1/shipments/${id}/handoff-export`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const entries = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select(['action', 'entity_type', 'entity_id'])
        .where('action', '=', 'handoff.export_created')
        .where('entity_id', '=', id)
        .execute(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.entity_type).toBe('shipment');
  });

  it('hides another tenant’s shipment', async () => {
    const tokenB = await ownerBToken();
    const idA = await newShipment(await ownerToken());
    await server()
      .post(`/api/v1/shipments/${idA}/handoff-export`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });

  it('denies client viewers', async () => {
    const viewer = await viewerToken();
    const id = await newShipment(await ownerToken());
    await server()
      .post(`/api/v1/shipments/${id}/handoff-export`)
      .set('Authorization', `Bearer ${viewer}`)
      .expect(403);
  });
});
