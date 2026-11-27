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

    // Agency-configured sample rules. Synthetic config, not ZRA data.
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
          },
          {
            id: uuidv7(),
            tenant_id: tenant,
            shipment_type: 'import',
            case_kind: 'vehicle',
            doc_type: 'purchase_invoice',
            label: 'Purchase invoice',
            sort_order: 2,
          },
          {
            id: uuidv7(),
            tenant_id: tenant,
            shipment_type: 'import',
            case_kind: 'goods',
            doc_type: 'goods_manifest',
            label: 'Goods manifest',
            sort_order: 3,
          },
          {
            id: uuidv7(),
            tenant_id: tenant,
            shipment_type: 'import',
            case_kind: null,
            doc_type: 'verified_example',
            label: 'Verified example',
            is_mandatory: false,
            sort_order: 4,
            source_url: 'https://example.com/source',
            verification_status: 'VERIFIED',
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

  it('personalises the checklist by case kind and keeps provenance visible', async () => {
    const token = await tokenFor(importerEmail);
    const created = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(201);
    const caseId = created.body.id as string;

    await db.withTenant(tenant, (trx) =>
      trx
        .insertInto('documents')
        .values({
          id: uuidv7(),
          tenant_id: tenant,
          shipment_id: caseId,
          doc_type: 'id_copy',
          label: 'Identity copy',
          created_by: importerId,
          updated_by: importerId,
        })
        .execute(),
    );

    const response = await server()
      .get(`/api/v1/cases/${caseId}/checklist`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = response.body as {
      caseKind: string;
      rules: Array<{
        docType: string;
        verificationStatus: string;
        sourceUrl: string | null;
        satisfied: boolean;
      }>;
      missingMandatory: string[];
      hasUnverifiedRules: boolean;
      notice: string;
    };
    expect(body.caseKind).toBe('vehicle');
    expect(body.rules.map((rule) => rule.docType)).toEqual([
      'id_copy',
      'purchase_invoice',
      'verified_example',
    ]);
    expect(body.missingMandatory).toEqual(['purchase_invoice']);
    expect(body.rules.find((rule) => rule.docType === 'id_copy')?.satisfied).toBe(true);
    expect(body.rules.find((rule) => rule.docType === 'verified_example')?.sourceUrl).toBe(
      'https://example.com/source',
    );
    expect(body.hasUnverifiedRules).toBe(true);
    expect(body.notice).toMatch(/not official requirements/);
  });

  it('denies another importer and agent staff access to someone else’s checklist', async () => {
    const token = await tokenFor(importerEmail);
    const created = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(201);
    const caseId = created.body.id as string;

    await server()
      .get(`/api/v1/cases/${caseId}/checklist`)
      .set('Authorization', `Bearer ${await tokenFor(otherEmail)}`)
      .expect(404);
    await server()
      .get(`/api/v1/cases/${caseId}/checklist`)
      .set('Authorization', `Bearer ${await tokenFor(staffEmail)}`)
      .expect(404);
  });

  it('answers the importer from the recorded hold, checklist and invoice balance', async () => {
    const token = await tokenFor(importerEmail);
    const created = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(201);
    const caseId = created.body.id as string;

    await db.withTenant(tenant, async (trx) => {
      await trx
        .updateTable('shipments')
        .set({ stage: 'on_hold', hold_reason: 'Need a signed proof of purchase' })
        .where('id', '=', caseId)
        .execute();
      await trx
        .insertInto('invoices')
        .values({
          id: uuidv7(),
          tenant_id: tenant,
          shipment_id: caseId,
          number: `INV-STATUS-${caseId.slice(0, 8)}`,
          status: 'partially_paid',
          total_minor: 100000,
          amount_paid_minor: 40000,
          created_by: staffId,
          updated_by: staffId,
        })
        .execute();
    });

    const response = await server()
      .get(`/api/v1/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = response.body as {
      caseId: string;
      answers: Array<{ question: string; answer: string }>;
      notice: string;
    };
    expect(body.caseId).toBe(caseId);
    expect(body.answers.map((item) => item.question)).toEqual([
      'Where is my case?',
      'Do you need anything from me?',
      'What do I owe?',
      'What happens next?',
    ]);
    expect(body.answers[0]?.answer).toContain('On hold');
    expect(body.answers[1]?.answer).toContain('Need a signed proof of purchase');
    expect(body.answers[2]?.answer).toMatch(/600\.00/);
    expect(body.answers[2]?.answer).toContain('not a ZRA assessment');
    expect(body.answers[3]?.answer).toContain('hold is resolved');
    expect(body.notice).toContain('ASYCUDA World');
  });

  it('reports no invoice and one missing item without claiming a customs decision', async () => {
    const token = await tokenFor(importerEmail);
    const created = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(201);
    const caseId = created.body.id as string;

    await db.withTenant(tenant, (trx) =>
      trx
        .insertInto('documents')
        .values({
          id: uuidv7(),
          tenant_id: tenant,
          shipment_id: caseId,
          doc_type: 'id_copy',
          label: 'Identity copy',
          created_by: importerId,
          updated_by: importerId,
        })
        .execute(),
    );

    const response = await server()
      .get(`/api/v1/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const answers = response.body.answers as Array<{ question: string; answer: string }>;
    expect(answers[0]?.answer).toContain('Documents received');
    expect(answers[1]?.answer).toContain('1 item still needed');
    expect(answers[2]?.answer).toBe('No invoice has been issued for this case yet.');
    expect(answers[3]?.answer).toContain('ASYCUDA World');
  });

  it('denies status reads to another importer and to agent staff', async () => {
    const token = await tokenFor(importerEmail);
    const created = await server()
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(vehicleCase)
      .expect(201);
    const caseId = created.body.id as string;

    const otherToken = await tokenFor(otherEmail);
    await server()
      .get(`/api/v1/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    const staffToken = await tokenFor(staffEmail);
    await server()
      .get(`/api/v1/cases/${caseId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
    await server()
      .get('/api/v1/cases/not-a-uuid/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
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
