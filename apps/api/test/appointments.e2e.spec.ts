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
const CONSENT = 'I consent to transfer this case to the appointed agency.';

const casePayload = {
  clientName: 'Banda Imports',
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

interface Importer {
  tenantId: string;
  userId: string;
  email: string;
}

describe('agent directory and consented appointment (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let passwordHash: string;

  const agencyTenant = uuidv7();
  const otherAgencyTenant = uuidv7();
  const agentId = uuidv7();
  const otherAgentId = uuidv7();
  const agentEmail = `appoint-agent-${agencyTenant}@example.com`;
  const otherAgentEmail = `appoint-agent-other-${otherAgencyTenant}@example.com`;

  /** Appointment moves an importer into the agency tenant, so each test gets its own. */
  async function newImporter(label: string): Promise<Importer> {
    const tenantId = uuidv7();
    const userId = uuidv7();
    const email = `appoint-${label}-${tenantId}@example.com`;
    await db.withTenant(tenantId, (trx) =>
      trx
        .insertInto('tenants')
        .values({ id: tenantId, name: `${label} Tenant` })
        .execute(),
    );
    await db.withTenant(tenantId, (trx) =>
      trx
        .insertInto('users')
        .values({
          id: userId,
          tenant_id: tenantId,
          email,
          password_hash: passwordHash,
          role: 'client_viewer',
        })
        .execute(),
    );
    return { tenantId, userId, email };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new ApiExceptionsFilter(pino({ level: 'silent' })));
    await app.init();

    db = app.get(DatabaseService);
    passwordHash = await app.get(PasswordService).hash(PASSWORD);

    for (const [id, name] of [
      [agencyTenant, 'Agency Tenant'],
      [otherAgencyTenant, 'Other Agency Tenant'],
    ] as const) {
      await db.withTenant(id, (trx) => trx.insertInto('tenants').values({ id, name }).execute());
    }

    await db.withTenant(agencyTenant, (trx) =>
      trx
        .insertInto('users')
        .values({
          id: agentId,
          tenant_id: agencyTenant,
          email: agentEmail,
          password_hash: passwordHash,
          role: 'agency_owner',
        })
        .execute(),
    );
    await db.withTenant(otherAgencyTenant, (trx) =>
      trx
        .insertInto('users')
        .values({
          id: otherAgentId,
          tenant_id: otherAgencyTenant,
          email: otherAgentEmail,
          password_hash: passwordHash,
          role: 'agent_staff',
        })
        .execute(),
    );

    await db.withTenant(agencyTenant, (trx) =>
      trx
        .insertInto('agent_profiles')
        .values({
          id: uuidv7(),
          tenant_id: agencyTenant,
          user_id: agentId,
          agency_name: 'Copperbelt Clearing',
          location: 'Ndola',
          is_published: true,
        })
        .execute(),
    );
    await db.withTenant(otherAgencyTenant, (trx) =>
      trx
        .insertInto('agent_profiles')
        .values({
          id: uuidv7(),
          tenant_id: otherAgencyTenant,
          user_id: otherAgentId,
          agency_name: 'Unpublished Agency',
          location: 'Lusaka',
          is_published: false,
        })
        .execute(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  const server = () => request(app.getHttpServer());

  // Access tokens stay valid after appointment; only refresh tokens are
  // revoked. The separate re-sign-in test asserts the new tenant claim.
  // Resolve the token BEFORE building a supertest request: supertest starts and
  // stops the shared server around each request, so awaiting a nested login in
  // a `.set()` argument would close the server under the outer request.
  const tokens = new Map<string, string>();
  async function bearer(email: string): Promise<string> {
    const cached = tokens.get(email);
    if (cached) return `Bearer ${cached}`;
    const response = await server()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const token = response.body.accessToken as string;
    tokens.set(email, token);
    return `Bearer ${token}`;
  }
  async function createCase(email: string): Promise<string> {
    const auth = await bearer(email);
    const response = await server()
      .post('/api/v1/cases')
      .set('Authorization', auth)
      .send(casePayload)
      .expect(201);
    return response.body.id as string;
  }

  it('lists only published, curated directory fields with a simulated licence notice', async () => {
    const importer = await newImporter('directory');
    const auth = await bearer(importer.email);
    const response = await server()
      .get('/api/v1/agent-profiles')
      .set('Authorization', auth)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      userId: agentId,
      agencyName: 'Copperbelt Clearing',
      location: 'Ndola',
      licenceStatus: 'SIMULATED',
      licenceNotice: 'Simulated, pending ZRA API',
    });
    expect(response.body[0]).not.toHaveProperty('email');
    expect(response.body[0]).not.toHaveProperty('tpin');
  });

  it('lets an agency publish its own profile and denies importers', async () => {
    const importer = await newImporter('profile-denied');
    const agentAuth = await bearer(agentEmail);
    const response = await server()
      .post('/api/v1/agent-profiles/me')
      .set('Authorization', agentAuth)
      .send({ agencyName: 'Copperbelt Clearing', location: 'Ndola', languages: 'English, Bemba' })
      .expect(201);
    expect(response.body).toMatchObject({
      isPublished: true,
      licenceStatus: 'SIMULATED',
      languages: 'English, Bemba',
    });

    const importerAuth = await bearer(importer.email);
    await server()
      .post('/api/v1/agent-profiles/me')
      .set('Authorization', importerAuth)
      .send({ agencyName: 'Nope', location: 'Lusaka' })
      .expect(403);
  });

  it('transfers the case and importer into the agency tenant with consent and dual audit', async () => {
    const importer = await newImporter('transfer');
    const caseId = await createCase(importer.email);
    const auth = await bearer(importer.email);
    const response = await server()
      .post('/api/v1/appointments')
      .set('Authorization', auth)
      .send({ caseId, agentUserId: agentId, consentText: CONSENT })
      .expect(201);

    expect(response.body).toEqual({
      agencyTenantId: agencyTenant,
      mustReauthenticate: true,
    });

    const shipment = await db.withTenant(agencyTenant, (trx) =>
      trx
        .selectFrom('shipments')
        .select(['tenant_id', 'assigned_agent_id', 'importer_user_id'])
        .where('id', '=', caseId)
        .executeTakeFirstOrThrow(),
    );
    expect(shipment).toMatchObject({
      tenant_id: agencyTenant,
      assigned_agent_id: agentId,
      importer_user_id: importer.userId,
    });

    const movedUser = await db.withTenant(agencyTenant, (trx) =>
      trx
        .selectFrom('users')
        .select('tenant_id')
        .where('id', '=', importer.userId)
        .executeTakeFirstOrThrow(),
    );
    expect(movedUser.tenant_id).toBe(agencyTenant);

    const appointment = await db.withTenant(agencyTenant, (trx) =>
      trx
        .selectFrom('appointments')
        .select(['consent_text', 'from_tenant_id'])
        .where('case_id', '=', caseId)
        .executeTakeFirstOrThrow(),
    );
    expect(appointment).toMatchObject({
      consent_text: CONSENT,
      from_tenant_id: importer.tenantId,
    });

    const auditFrom = await db.withTenant(importer.tenantId, (trx) =>
      trx.selectFrom('audit_logs').select('action').where('entity_id', '=', caseId).execute(),
    );
    expect(auditFrom.map((row) => row.action)).toContain('case.appointed');
    const auditTo = await db.withTenant(agencyTenant, (trx) =>
      trx.selectFrom('audit_logs').select('action').where('entity_id', '=', caseId).execute(),
    );
    expect(auditTo.map((row) => row.action)).toContain('case.received');

    const sessions = await db.withTenant(importer.tenantId, (trx) =>
      trx
        .selectFrom('refresh_tokens')
        .select('revoked_at')
        .where('user_id', '=', importer.userId)
        .execute(),
    );
    expect(sessions.every((row) => row.revoked_at !== null)).toBe(true);
  });

  it('requires re-sign-in and then shows the case in the agency tenant', async () => {
    const importer = await newImporter('relogin');
    const caseId = await createCase(importer.email);
    const auth = await bearer(importer.email);
    await server()
      .post('/api/v1/appointments')
      .set('Authorization', auth)
      .send({ caseId, agentUserId: agentId, consentText: CONSENT })
      .expect(201);

    const login = await server()
      .post('/api/v1/auth/login')
      .send({ email: importer.email, password: PASSWORD })
      .expect(200);
    expect(login.body.user.tenantId).toBe(agencyTenant);

    await server()
      .get(`/api/v1/shipments/${caseId}`)
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(200);
  });

  it('rejects a second appointment and an agent without a published profile', async () => {
    const importer = await newImporter('conflicts');
    const caseId = await createCase(importer.email);
    const secondCase = await createCase(importer.email);
    const auth = await bearer(importer.email);
    await server()
      .post('/api/v1/appointments')
      .set('Authorization', auth)
      .send({ caseId, agentUserId: agentId, consentText: CONSENT })
      .expect(201);

    // The first appointment moved the case, so a re-signed-in agency-tenant
    // token is needed to see the conflict rather than a tenant-scoped 404.
    const relogin = await server()
      .post('/api/v1/auth/login')
      .send({ email: importer.email, password: PASSWORD })
      .expect(200);
    const agencyAuth = `Bearer ${relogin.body.accessToken as string}`;
    await server()
      .post('/api/v1/appointments')
      .set('Authorization', agencyAuth)
      .send({ caseId, agentUserId: agentId, consentText: CONSENT })
      .expect(409);

    await server()
      .post('/api/v1/appointments')
      .set('Authorization', auth)
      .send({ caseId: secondCase, agentUserId: otherAgentId, consentText: CONSENT })
      .expect(400);
  });

  it('does not let another importer appoint someone else’s case', async () => {
    const importer = await newImporter('owner-case');
    const other = await newImporter('not-owner');
    const caseId = await createCase(importer.email);
    const auth = await bearer(other.email);
    await server()
      .post('/api/v1/appointments')
      .set('Authorization', auth)
      .send({ caseId, agentUserId: agentId, consentText: CONSENT })
      .expect(404);
  });
});
