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

describe('compliance assistant and estimator (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenant = uuidv7();
  const importerId = uuidv7();
  const otherImporterId = uuidv7();
  const staffId = uuidv7();
  const importerEmail = `compliance-importer-${tenant}@example.com`;
  const otherEmail = `compliance-other-${tenant}@example.com`;
  const staffEmail = `compliance-staff-${tenant}@example.com`;
  let caseId = '';

  const vehicleCase = {
    clientName: 'Compliance Test Importer',
    clientContact: '+260970000002',
    consignment: {
      caseKind: 'vehicle',
      vehicle: {
        make: 'Toyota',
        model: 'Hilux',
        year: 2022,
        vinOrChassis: 'AHTFR22C000000002',
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
    const hash = await app.get(PasswordService).hash(PASSWORD);

    await db.withTenant(tenant, (trx) =>
      trx.insertInto('tenants').values({ id: tenant, name: 'Compliance Tenant' }).execute(),
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
    await db.withTenant(tenant, (trx) =>
      trx
        .insertInto('document_requirements')
        .values([
          {
            id: uuidv7(),
            tenant_id: tenant,
            shipment_type: 'import',
            case_kind: null,
            doc_type: 'id_copy',
            label: 'Identity copy',
            sort_order: 1,
            source_url: 'https://example.com/agency-note',
            verification_status: 'NEEDS_VERIFICATION',
          },
          {
            id: uuidv7(),
            tenant_id: tenant,
            shipment_type: 'import',
            case_kind: 'goods',
            doc_type: 'goods_manifest',
            label: 'Goods manifest',
            sort_order: 2,
          },
        ])
        .execute(),
    );

    const token = await tokenFor(importerEmail);
    const created = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(201);
    caseId = created.body.id as string;
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

  it('gives the importer labelled prompts from their own case and agency config', async () => {
    const token = await tokenFor(importerEmail);
    const response = await server()
      .get(`/api/v1/compliance/assistant/${caseId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.caseId).toBe(caseId);
    expect(response.body.wordingSource).toBe('fixed');
    expect(response.body.notice).toContain('not legal advice');
    expect(response.body.prompts).toHaveLength(2);
    expect(response.body.prompts[0]).toMatchObject({
      id: 'agency:id_copy',
      origin: 'agency_requirement',
      verificationStatus: 'NEEDS_VERIFICATION',
      sourceUrl: 'https://example.com/agency-note',
    });
    expect(response.body.prompts[1]).toMatchObject({
      id: 'case:recorded-value',
      origin: 'case_fact',
    });
    // The goods-only rule must not appear on a vehicle case.
    expect(JSON.stringify(response.body.prompts)).not.toContain('goods_manifest');
  });

  it('never lets another importer or staff read the assistant for this case', async () => {
    const otherToken = await tokenFor(otherEmail);
    await server()
      .get(`/api/v1/compliance/assistant/${caseId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    const staffToken = await tokenFor(staffEmail);
    await server()
      .get(`/api/v1/compliance/assistant/${caseId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(404);
    await server()
      .get('/api/v1/compliance/assistant/not-a-uuid')
      .set('Authorization', `Bearer ${await tokenFor(importerEmail)}`)
      .expect(400);
  });

  it('refuses an estimate when no VERIFIED tariff data is configured', async () => {
    const token = await tokenFor(importerEmail);
    const response = await server()
      .post('/api/v1/compliance/estimate')
      .set('Authorization', `Bearer ${token}`)
      .send({ hsCode: '1102200000', customsValueMinor: 1_000_000, currency: 'ZMW' })
      .expect(201);

    expect(response.body).toMatchObject({ kind: 'refused', reason: 'no_verified_rule' });
    expect(response.body.notice).toContain('Do not pay or file');
  });

  it('rejects invalid estimate input with 400', async () => {
    const token = await tokenFor(importerEmail);
    await server()
      .post('/api/v1/compliance/estimate')
      .set('Authorization', `Bearer ${token}`)
      .send({ hsCode: 'not-a-code', customsValueMinor: -1, currency: 'ZMW' })
      .expect(400);
  });
});
