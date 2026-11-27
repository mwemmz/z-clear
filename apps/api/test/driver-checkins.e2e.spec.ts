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

/** Manual driver check-ins: assignment, scoping, append-only event and audit. */
describe('driver check-ins (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenant = uuidv7();
  const otherTenant = uuidv7();
  const staffId = uuidv7();
  const driverId = uuidv7();
  const otherDriverId = uuidv7();
  const importerId = uuidv7();
  const outsiderDriverId = uuidv7();
  const shipmentId = uuidv7();
  const otherShipmentId = uuidv7();
  const staffEmail = `driver-staff-${tenant}@example.com`;
  const driverEmail = `driver-${tenant}@example.com`;
  const otherDriverEmail = `driver-other-${tenant}@example.com`;
  const importerEmail = `driver-importer-${tenant}@example.com`;
  const outsiderEmail = `driver-outsider-${otherTenant}@example.com`;

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

    // Each tenant row must be inserted inside its own RLS tenant context.
    await db.withTenant(tenant, (trx) =>
      trx.insertInto('tenants').values({ id: tenant, name: 'Driver Tenant' }).execute(),
    );
    await db.withTenant(otherTenant, (trx) =>
      trx.insertInto('tenants').values({ id: otherTenant, name: 'Other Driver Tenant' }).execute(),
    );
    await db.withTenant(tenant, (trx) =>
      trx
        .insertInto('users')
        .values([
          {
            id: staffId,
            tenant_id: tenant,
            email: staffEmail,
            password_hash: hash,
            role: 'agent_staff',
          },
          {
            id: driverId,
            tenant_id: tenant,
            email: driverEmail,
            password_hash: hash,
            role: 'driver',
          },
          {
            id: otherDriverId,
            tenant_id: tenant,
            email: otherDriverEmail,
            password_hash: hash,
            role: 'driver',
          },
          {
            id: importerId,
            tenant_id: tenant,
            email: importerEmail,
            password_hash: hash,
            role: 'client_viewer',
          },
        ])
        .execute(),
    );
    await db.withTenant(otherTenant, (trx) =>
      trx
        .insertInto('users')
        .values({
          id: outsiderDriverId,
          tenant_id: otherTenant,
          email: outsiderEmail,
          password_hash: hash,
          role: 'driver',
        })
        .execute(),
    );
    for (const [id, reference] of [
      [shipmentId, 'DRIVER-IMPORT-0001'],
      [otherShipmentId, 'DRIVER-IMPORT-0002'],
    ] as const) {
      await db.withTenant(tenant, (trx) =>
        trx
          .insertInto('shipments')
          .values({
            id,
            tenant_id: tenant,
            reference,
            client_name: 'Synthetic Importer',
            type: 'import',
            importer_user_id: importerId,
            assigned_agent_id: staffId,
          })
          .execute(),
      );
    }

    // Resolve tokens before constructing requests: awaiting inside .set() can
    // hand supertest a null socket.
    await Promise.all([
      tokenFor(staffEmail),
      tokenFor(driverEmail),
      tokenFor(otherDriverEmail),
      tokenFor(importerEmail),
      tokenFor(outsiderEmail),
    ]);
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

  async function tokenHeader(email: string): Promise<{ Authorization: string }> {
    return { Authorization: `Bearer ${await tokenFor(email)}` };
  }

  it('lets staff assign a tenant driver and shows the assignment on the case', async () => {
    const response = await server()
      .post(`/api/v1/shipments/${shipmentId}/assign-driver`)
      .set(await tokenHeader(staffEmail))
      .send({ driverId })
      .expect(200);
    expect(response.body.driverUserId).toBe(driverId);
  });

  it('refuses to assign a user who is not an active tenant driver', async () => {
    await server()
      .post(`/api/v1/shipments/${otherShipmentId}/assign-driver`)
      .set(await tokenHeader(staffEmail))
      .send({ driverId: importerId })
      .expect(400);
    await server()
      .post(`/api/v1/shipments/${otherShipmentId}/assign-driver`)
      .set(await tokenHeader(staffEmail))
      .send({ driverId: outsiderDriverId })
      .expect(400);
  });

  it('restricts a driver to shipments assigned to them', async () => {
    const list = await server()
      .get('/api/v1/shipments')
      .set(await tokenHeader(driverEmail))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(shipmentId);

    await server()
      .get(`/api/v1/shipments/${shipmentId}`)
      .set(await tokenHeader(driverEmail))
      .expect(200);
    await server()
      .get(`/api/v1/shipments/${otherShipmentId}`)
      .set(await tokenHeader(driverEmail))
      .expect(404);
  });

  it('records a manual border check-in as an append-only event with an audit entry', async () => {
    const response = await server()
      .post(`/api/v1/shipments/${shipmentId}/check-in`)
      .set(await tokenHeader(driverEmail))
      .send({ borderPost: 'Kasumbalesa', note: 'Synthetic sample check-in' })
      .expect(200);
    expect(response.body).toMatchObject({
      source: 'driver',
      fromStage: 'docs_received',
      toStage: 'docs_received',
    });
    expect(response.body.note).toContain('Kasumbalesa');

    const detail = await server()
      .get(`/api/v1/shipments/${shipmentId}`)
      .set(await tokenHeader(staffEmail))
      .expect(200);
    // The stage is unchanged: a check-in is an observation, not a release.
    expect(detail.body.stage).toBe('docs_received');
    expect(detail.body.events.some((event: { id: string }) => event.id === response.body.id)).toBe(
      true,
    );

    const audit = await db.withTenant(tenant, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select(['action', 'entity_id'])
        .where('action', '=', 'shipment.check_in')
        .execute(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]?.entity_id).toBe(shipmentId);
  });

  it('denies check-ins to unassigned, importer and cross-tenant users', async () => {
    await server()
      .post(`/api/v1/shipments/${otherShipmentId}/check-in`)
      .set(await tokenHeader(driverEmail))
      .send({ borderPost: 'Kasumbalesa' })
      .expect(404);
    await server()
      .post(`/api/v1/shipments/${shipmentId}/check-in`)
      .set(await tokenHeader(otherDriverEmail))
      .send({ borderPost: 'Kasumbalesa' })
      .expect(404);
    await server()
      .post(`/api/v1/shipments/${shipmentId}/check-in`)
      .set(await tokenHeader(importerEmail))
      .send({ borderPost: 'Kasumbalesa' })
      .expect(403);
    await server()
      .post(`/api/v1/shipments/${shipmentId}/check-in`)
      .set(await tokenHeader(outsiderEmail))
      .send({ borderPost: 'Kasumbalesa' })
      .expect(404);
  });

  it('validates ids and check-in input', async () => {
    await server()
      .post('/api/v1/shipments/not-a-uuid/check-in')
      .set(await tokenHeader(driverEmail))
      .send({ borderPost: 'Kasumbalesa' })
      .expect(400);
    await server()
      .post(`/api/v1/shipments/${shipmentId}/check-in`)
      .set(await tokenHeader(driverEmail))
      .send({ borderPost: '   ' })
      .expect(400);
  });
});
