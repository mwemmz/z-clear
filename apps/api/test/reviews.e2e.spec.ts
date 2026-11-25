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

/**
 * Full importer-review flow: assignment, send, importer query, revision,
 * approval, stale-approval rejection, permission boundaries, cross-tenant
 * denial and one ledger entry per qualifying event.
 */
describe('importer reviews (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const staffA = uuidv7();
  const importerA = uuidv7();
  const otherImporterA = uuidv7();
  const ownerB = uuidv7();
  const importerB = uuidv7();
  const ownerAEmail = `owner-a-${tenantA}@example.com`;
  const staffAEmail = `staff-a-${tenantA}@example.com`;
  const importerAEmail = `importer-a-${tenantA}@example.com`;
  const otherImporterAEmail = `other-importer-a-${tenantA}@example.com`;
  const ownerBEmail = `owner-b-${tenantB}@example.com`;
  const importerBEmail = `importer-b-${tenantB}@example.com`;

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
      trx.insertInto('tenants').values({ id: tenantA, name: 'Review Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Review Tenant B' }).execute(),
    );
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('users')
        .values([
          { id: ownerA, tenant_id: tenantA, email: ownerAEmail, password_hash: hash, role: 'agency_owner' },
          { id: staffA, tenant_id: tenantA, email: staffAEmail, password_hash: hash, role: 'agent_staff' },
          { id: importerA, tenant_id: tenantA, email: importerAEmail, password_hash: hash, role: 'client_viewer', tpin: '1001111222' },
          { id: otherImporterA, tenant_id: tenantA, email: otherImporterAEmail, password_hash: hash, role: 'client_viewer', tpin: '2002222333' },
        ])
        .execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx
        .insertInto('users')
        .values([
          { id: ownerB, tenant_id: tenantB, email: ownerBEmail, password_hash: hash, role: 'agency_owner' },
          { id: importerB, tenant_id: tenantB, email: importerBEmail, password_hash: hash, role: 'client_viewer' },
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

  async function assignedShipment(
    token: string,
    overrides: { importerUserId?: string; clientContact?: string | null; consignment?: Record<string, unknown> } = {},
  ): Promise<{ id: string; reviewFreshness: number }> {
    const response = await server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reference: `REF-${uuidv7()}`,
        clientName: 'Kafue Metals Ltd',
        type: 'import',
        origin: 'Durban',
        destination: 'Lusaka',
        importerUserId: overrides.importerUserId ?? importerA,
        consignment: overrides.consignment ?? { tpin: '1001111222' },
        ...(overrides.clientContact === undefined
          ? { clientContact: 'imports@kafuemetals.example' }
          : overrides.clientContact === null
            ? {}
            : { clientContact: overrides.clientContact }),
      })
      .expect(201);
    return { id: response.body.id, reviewFreshness: response.body.reviewFreshness };
  }

  it('runs the full flow: send, query, revise, approve — and the approval binds to the corrected revision', async () => {
    const staffToken = await tokenFor(staffAEmail);
    const importerToken = await tokenFor(importerAEmail);
    const shipment = await assignedShipment(staffToken);

    // Send: revision 1 goes in_review and earns review_sent points once.
    const sent = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Please confirm the details below.' })
      .expect(200);
    expect(sent.body).toMatchObject({ revision: 1, state: 'in_review' });
    expect(sent.body.allowedActions).toContain('query');
    expect(sent.body.wording).toContain(shipment.id === sent.body.shipmentId ? 'Review request' : '');
    expect(sent.body.draftFindings).toEqual([]);

    // Importer queries it.
    const queried = await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/query`)
      .set('Authorization', `Bearer ${importerToken}`)
      .send({ message: 'Is the consignment TPIN ours?' })
      .expect(200);
    expect(queried.body).toMatchObject({ state: 'queried' });

    // Staff revises: a new draft revision 2 supersedes revision 1.
    const revised = await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/revise`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ newMessage: 'Corrected: TPIN confirmed with the importer.' })
      .expect(200);
    expect(revised.body).toMatchObject({ revision: 2, state: 'draft', parentReviewId: sent.body.id });

    // Revision 1 can no longer be approved (superseded).
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);

    // Send the corrected revision 2, then approve it.
    const sentAgain = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Corrected: TPIN confirmed with the importer.' })
      .expect(200);
    expect(sentAgain.body).toMatchObject({ revision: 2, state: 'in_review' });

    const approved = await server()
      .post(`/api/v1/reviews/${sentAgain.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(approved.body).toMatchObject({ revision: 2, state: 'approved' });

    // One ledger entry per qualifying event: two sends (rev 1, rev 2), one approval.
    const points = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('review_points')
        .select(['event', 'points'])
        .where('shipment_id', '=', shipment.id)
        .orderBy('event', 'asc')
        .execute(),
    );
    expect(points).toHaveLength(3);
    expect(points.filter((row) => row.event === 'review_sent')).toHaveLength(2);
    expect(points.filter((row) => row.event === 'review_approved')).toHaveLength(1);

    // The append-only ledger refuses edits.
    await expect(
      db.withTenant(tenantA, (trx) =>
        trx
          .updateTable('review_points')
          .set({ points: 999 })
          .where('shipment_id', '=', shipment.id)
          .execute(),
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('blocks a send with a blocking draft finding and keeps the revision a draft', async () => {
    const staffToken = await tokenFor(staffAEmail);
    const shipment = await assignedShipment(staffToken, { clientContact: null });

    const response = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Missing contact on purpose.' })
      .expect(200);
    expect(response.body.state).toBe('draft');
    expect(response.body.draftFindings.map((f: { code: string }) => f.code)).toContain(
      'missing_contact',
    );
    expect(response.body.sentAt).toBeNull();

    // No points for a blocked send.
    const points = await db.withTenant(tenantA, (trx) =>
      trx.selectFrom('review_points').select('id').where('shipment_id', '=', shipment.id).execute(),
    );
    expect(points).toHaveLength(0);
  });

  it('flags a TPIN mismatch with the importer record as a warning, not a block', async () => {
    const staffToken = await tokenFor(staffAEmail);
    const shipment = await assignedShipment(staffToken, { consignment: { tpin: '9998887776' } });

    const response = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'TPIN needs checking.' })
      .expect(200);
    expect(response.body.state).toBe('in_review');
    const codes = response.body.draftFindings.map((f: { code: string }) => f.code);
    expect(codes).toContain('tpin_mismatch');
  });

  it('rejects approval after a material shipment edit and requires a fresh review', async () => {
    const ownerToken = await tokenFor(ownerAEmail);
    const staffToken = await tokenFor(staffAEmail);
    const shipment = await assignedShipment(ownerToken);

    const sent = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Ready for your check.' })
      .expect(200);

    // Material edit bumps freshness.
    await server()
      .patch(`/api/v1/shipments/${shipment.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ destination: 'Ndola' })
      .expect(200);

    const response = await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);
    expect(response.body.error.message).toMatch(/changed after this review was raised/i);

    // Recovery path: revise against the new baseline, re-send, then approve.
    const revised = await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/revise`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ newMessage: 'Refreshed for the updated destination.' })
      .expect(200);
    expect(revised.body).toMatchObject({ revision: 2, state: 'draft' });

    // A non-material edit (stage) does not bump freshness and does not block.
    await server()
      .post(`/api/v1/shipments/${shipment.id}/stage`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ stage: 'submitted' })
      .expect(200);

    const sentAgain = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Refreshed for the updated destination.' })
      .expect(200);
    expect(sentAgain.body).toMatchObject({ revision: 2, state: 'in_review' });

    await server()
      .post(`/api/v1/reviews/${sentAgain.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });

  it('enforces invalid transitions and permission boundaries', async () => {
    const staffToken = await tokenFor(staffAEmail);
    const importerToken = await tokenFor(importerAEmail);
    const shipment = await assignedShipment(staffToken);

    // Importer cannot send, revise or approve.
    await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${importerToken}`)
      .send({ message: 'self-serve' })
      .expect(403);

    const sent = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Details for your review.' })
      .expect(200);
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/approve`)
      .set('Authorization', `Bearer ${importerToken}`)
      .expect(403);
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/revise`)
      .set('Authorization', `Bearer ${importerToken}`)
      .send({ newMessage: 'importer cannot revise' })
      .expect(403);

    // Sending again while in_review is rejected.
    await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'again' })
      .expect(409);

    // Importer queries -> queried; a queried revision cannot be queried again
    // or approved; only revise is legal.
    const queried = await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/query`)
      .set('Authorization', `Bearer ${importerToken}`)
      .send({ message: 'What is the consignment weight?' })
      .expect(200);
    expect(queried.body).toMatchObject({ state: 'queried' });
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/query`)
      .set('Authorization', `Bearer ${importerToken}`)
      .send({ message: 'asking twice' })
      .expect(409);
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);
    await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'cannot send over queried' })
      .expect(409);

    // Revise opens draft revision 2: a draft cannot be queried or approved.
    const revised = await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/revise`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ newMessage: 'Weight corrected.' })
      .expect(200);
    await server()
      .post(`/api/v1/reviews/${revised.body.id as string}/query`)
      .set('Authorization', `Bearer ${importerToken}`)
      .send({ message: 'too early' })
      .expect(409);
    await server()
      .post(`/api/v1/reviews/${revised.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);

    // Send revision 2, approve it, and prove an approved revision is final.
    const sent2 = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Weight corrected.' })
      .expect(200);
    const approved = await server()
      .post(`/api/v1/reviews/${sent2.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(approved.body).toMatchObject({ state: 'approved' });
    await server()
      .post(`/api/v1/reviews/${sent2.body.id as string}/approve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(409);
    await server()
      .post(`/api/v1/reviews/${sent2.body.id as string}/query`)
      .set('Authorization', `Bearer ${importerToken}`)
      .send({ message: 'too late' })
      .expect(409);
    await server()
      .post(`/api/v1/reviews/${sent2.body.id as string}/revise`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ newMessage: 'cannot revise approved' })
      .expect(409);

    // Missing message bodies are validation errors, not state conflicts.
    await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({})
      .expect(400);
  });

  it('restricts a client_viewer to their assigned shipments only (same-tenant unrelated importer)', async () => {
    const staffToken = await tokenFor(staffAEmail);
    const otherImporterToken = await tokenFor(otherImporterAEmail);
    const shipment = await assignedShipment(staffToken); // assigned to importerA

    const sent = await server()
      .post(`/api/v1/shipments/${shipment.id}/review/send`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ message: 'Not for other importers.' })
      .expect(200);

    // List does not leak the review.
    const list = await server()
      .get('/api/v1/reviews')
      .set('Authorization', `Bearer ${otherImporterToken}`)
      .expect(200);
    expect(list.body.map((row: { id: string }) => row.id)).not.toContain(sent.body.id);

    // Direct get, query are denied (404 semantics, no existence leak).
    await server()
      .get(`/api/v1/reviews/${sent.body.id as string}`)
      .set('Authorization', `Bearer ${otherImporterToken}`)
      .expect(404);
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/query`)
      .set('Authorization', `Bearer ${otherImporterToken}`)
      .send({ message: 'sneaky' })
      .expect(404);

    // The assigned importer sees it.
    const importerToken = await tokenFor(importerAEmail);
    const mine = await server()
      .get(`/api/v1/reviews/${sent.body.id as string}`)
      .set('Authorization', `Bearer ${importerToken}`)
      .expect(200);
    expect(mine.body.id).toBe(sent.body.id);
  });

  it('denies cross-tenant access end to end', async () => {
    const staffAToken = await tokenFor(staffAEmail);
    const ownerBToken = await tokenFor(ownerBEmail);
    const importerBToken = await tokenFor(importerBEmail);
    const shipmentA = await assignedShipment(staffAToken);

    const sent = await server()
      .post(`/api/v1/shipments/${shipmentA.id}/review/send`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ message: 'Tenant A only.' })
      .expect(200);

    // Tenant B's owner cannot read, query or approve tenant A's review.
    await server()
      .get(`/api/v1/reviews/${sent.body.id as string}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/query`)
      .set('Authorization', `Bearer ${importerBToken}`)
      .send({ message: 'from tenant B' })
      .expect(404);
    await server()
      .post(`/api/v1/reviews/${sent.body.id as string}/approve`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);

    // Tenant B cannot send a review for tenant A's shipment.
    await server()
      .post(`/api/v1/shipments/${shipmentA.id}/review/send`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ message: 'cross-tenant' })
      .expect(404);

    // RLS backstop: direct cross-tenant insert is rejected.
    await expect(
      db.withTenant(tenantB, (trx) =>
        trx
          .insertInto('importer_reviews')
          .values({
            id: uuidv7(),
            tenant_id: tenantA,
            shipment_id: shipmentA.id,
            revision: 1,
            shipment_reference: 'X',
            client_name: 'X',
            client_contact: 'x@example.com',
            shipment_type: 'import',
            baseline_freshness: 0,
          })
          .execute(),
      ),
    ).rejects.toThrow();
  });

  it('refuses to send when no importer is assigned', async () => {
    const ownerToken = await tokenFor(ownerAEmail);
    const created = await server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reference: `REF-${uuidv7()}`, clientName: 'No Importer Ltd', type: 'import' })
      .expect(201);
    await server()
      .post(`/api/v1/shipments/${created.body.id as string}/review/send`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ message: 'no importer assigned' })
      .expect(409);
  });

  it('rejects assignment of a cross-tenant or wrong-role importer', async () => {
    const ownerToken = await tokenFor(ownerAEmail);
    // Tenant B's importer user id is invisible to tenant A: RLS makes the
    // validation lookup return nothing -> validation error, no leak.
    await server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        reference: `REF-${uuidv7()}`,
        clientName: 'Cross Tenant Ltd',
        type: 'import',
        importerUserId: importerB,
      })
      .expect(400);
    // An agency_owner user cannot be an importer.
    await server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        reference: `REF-${uuidv7()}`,
        clientName: 'Wrong Role Ltd',
        type: 'import',
        importerUserId: ownerA,
      })
      .expect(400);
  });
});
