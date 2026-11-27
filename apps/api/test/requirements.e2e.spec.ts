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

describe('document requirements (e2e)', () => {
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

    for (const [id, name] of [
      [tenantA, 'Requirements Tenant A'],
      [tenantB, 'Requirements Tenant B'],
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
            email: `req-owner-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'agency_owner',
          },
          {
            id: viewerA,
            tenant_id: tenantA,
            email: `req-viewer-a-${tenantA}@example.com`,
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
          email: `req-owner-b-${tenantB}@example.com`,
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

  const ownerToken = () => tokenFor(`req-owner-a-${tenantA}@example.com`);
  const viewerToken = () => tokenFor(`req-viewer-a-${tenantA}@example.com`);
  const ownerBToken = () => tokenFor(`req-owner-b-${tenantB}@example.com`);

  it('creates, lists, updates and removes an agency-owned requirement', async () => {
    const token = await ownerToken();
    const created = await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shipmentType: 'import',
        docType: 'bill_of_lading',
        label: 'Bill of lading',
        isMandatory: true,
        sortOrder: 1,
      })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body.isActive).toBe(true);

    const list = await server()
      .get('/api/v1/requirements?shipmentType=import')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.some((row: { id: string }) => row.id === id)).toBe(true);

    await server()
      .patch(`/api/v1/requirements/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Original bill of lading', isMandatory: false })
      .expect(200);
    const afterUpdate = await server()
      .get('/api/v1/requirements?shipmentType=import')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const row = afterUpdate.body.find((item: { id: string }) => item.id === id);
    expect(row.label).toBe('Original bill of lading');
    expect(row.isMandatory).toBe(false);

    await server()
      .delete(`/api/v1/requirements/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const afterDelete = await server()
      .get('/api/v1/requirements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterDelete.body.some((item: { id: string }) => item.id === id)).toBe(false);

    const audit = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select('action')
        .where('entity_id', '=', id)
        .orderBy('created_at', 'asc')
        .execute(),
    );
    expect(audit.map((entry) => entry.action)).toEqual([
      'requirement.created',
      'requirement.updated',
      'requirement.deleted',
    ]);
  });

  it('rejects duplicates and malformed doc types', async () => {
    const token = await ownerToken();
    const payload = {
      shipmentType: 'export',
      docType: 'invoice_copy',
      label: 'Invoice copy',
    };
    await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(409);
    await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, docType: 'Not A Type' })
      .expect(400);
  });

  it('denies writes to importers and isolates tenants', async () => {
    const viewer = await viewerToken();
    await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${viewer}`)
      .send({ shipmentType: 'transit', docType: 'transit_note', label: 'Transit note' })
      .expect(403);

    const tokenB = await ownerBToken();
    const createdB = await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ shipmentType: 'transit', docType: 'tenant_b_only', label: 'Tenant B only' })
      .expect(201);
    const idB = createdB.body.id as string;

    await server()
      .patch(`/api/v1/requirements/${idB}`)
      .set('Authorization', `Bearer ${await ownerToken()}`)
      .send({ label: 'Stolen' })
      .expect(404);
    const listA = await server()
      .get('/api/v1/requirements')
      .set('Authorization', `Bearer ${await ownerToken()}`)
      .expect(200);
    expect(listA.body.some((row: { id: string }) => row.id === idB)).toBe(false);
  });

  it('stores provenance and refuses VERIFIED without a source', async () => {
    const token = await ownerToken();
    await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shipmentType: 'import',
        caseKind: 'vehicle',
        docType: 'sample_title',
        label: 'Sample title',
        sourceUrl: 'https://example.com/rule',
        effectiveDate: '2026-11-01',
        verificationStatus: 'VERIFIED',
      })
      .expect(201);

    await server()
      .post('/api/v1/requirements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shipmentType: 'export',
        caseKind: 'goods',
        docType: 'no_source',
        label: 'No source',
        verificationStatus: 'VERIFIED',
      })
      .expect(400);

    const list = await server()
      .get('/api/v1/requirements?shipmentType=import&caseKind=vehicle')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const row = list.body.find((item: { docType: string }) => item.docType === 'sample_title');
    expect(row).toMatchObject({
      caseKind: 'vehicle',
      sourceUrl: 'https://example.com/rule',
      effectiveDate: '2026-11-01',
      verificationStatus: 'VERIFIED',
    });
  });
});
