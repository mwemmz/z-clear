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

describe('importer cases (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenant = uuidv7();
  const importerId = uuidv7();
  const otherImporterId = uuidv7();
  const staffId = uuidv7();
  const importerEmail = `case-importer-${tenant}@example.com`;
  const otherEmail = `case-other-${tenant}@example.com`;
  const staffEmail = `case-staff-${tenant}@example.com`;

  const vehicleCase = {
    clientName: 'Chola Imports',
    clientContact: '+260970000001',
    consignment: {
      caseKind: 'vehicle',
      vehicle: {
        make: 'Toyota',
        model: 'Hilux',
        year: 2022,
        vinOrChassis: 'AHTFR22C000000001',
        engine: '2GD-FTV',
        purchasePriceMinor: 1850000000,
        currency: 'ZMW',
        origin: 'Japan',
        portOfEntry: 'Ndola',
      },
    },
  };

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

    await db.withTenant(tenant, (trx) =>
      trx.insertInto('tenants').values({ id: tenant, name: 'Cases Tenant' }).execute(),
    );
    await db.withTenant(tenant, (trx) =>
      trx
        .insertInto('users')
        .values([
          {
            id: importerId,
            tenant_id: tenant,
            email: importerEmail,
            password_hash: hash,
            role: 'client_viewer',
          },
          {
            id: otherImporterId,
            tenant_id: tenant,
            email: otherEmail,
            password_hash: hash,
            role: 'client_viewer',
          },
          {
            id: staffId,
            tenant_id: tenant,
            email: staffEmail,
            password_hash: hash,
            role: 'agent_staff',
          },
        ])
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

  it('creates a vehicle case owned by the signed-in importer', async () => {
    const token = await tokenFor(importerEmail);
    const response = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(201);

    expect(response.body.reference).toMatch(/^CASE-[0-9A-F]{12}$/);
    expect(response.body).toMatchObject({
      type: 'import',
      stage: 'docs_received',
      clientName: 'Chola Imports',
      importerUserId: importerId,
      assignedAgentId: null,
    });
    expect(response.body.consignment).toMatchObject({
      caseKind: 'vehicle',
      vehicle: { make: 'Toyota', vinOrChassis: 'AHTFR22C000000001' },
    });
  });

  it('creates a goods case with typed details', async () => {
    const token = await tokenFor(importerEmail);
    const response = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientName: 'Chola Imports',
        clientContact: '+260970000001',
        consignment: {
          caseKind: 'goods',
          goods: {
            description: 'Packaged maize flour',
            hsCode: '110220',
            quantity: 400,
            unit: 'bag',
            valueMinor: 32000000,
            currency: 'ZMW',
            origin: 'Zambia',
            portOfEntry: 'Lusaka',
          },
        },
      })
      .expect(201);
    expect(response.body.consignment.caseKind).toBe('goods');
  });

  it('lets an importer list only their own cases', async () => {
    const token = await tokenFor(importerEmail);
    const response = await server()
      .get('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.length).toBeGreaterThan(0);
    for (const row of response.body as Array<{ importerUserId: string | null }>) {
      expect(row.importerUserId).toBe(importerId);
    }

    const other = await tokenFor(otherEmail);
    const otherList = await server()
      .get('/api/v1/shipments')
      .set('Authorization', `Bearer ${other}`)
      .expect(200);
    expect(otherList.body).toEqual([]);
  });

  it('denies case creation to agent staff', async () => {
    const token = await tokenFor(staffEmail);
    await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(403);
  });

  it('rejects untyped, incomplete or unknown consignment fields', async () => {
    const token = await tokenFor(importerEmail);
    const badCases = [
      { ...vehicleCase, consignment: { caseKind: 'vehicle' } },
      {
        ...vehicleCase,
        consignment: {
          ...vehicleCase.consignment,
          vehicle: { ...vehicleCase.consignment.vehicle, purchasePriceMinor: 1.5 },
        },
      },
      {
        ...vehicleCase,
        consignment: { ...vehicleCase.consignment, caseKind: 'vehicle', dutyRate: 16 },
      },
    ];
    for (const body of badCases) {
      await server()
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
    }
  });

  it('writes case.created and shipment.created audit rows', async () => {
    const rows = await db.withTenant(tenant, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select('action')
        .where('entity_type', '=', 'shipment')
        .where('actor_user_id', '=', importerId)
        .orderBy('created_at', 'desc')
        .limit(10)
        .execute(),
    );
    expect(rows.map((row) => row.action)).toContain('case.created');
    expect(rows.map((row) => row.action)).toContain('shipment.created');
  });
});
