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

describe('billing (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const viewerA = uuidv7();
  const ownerB = uuidv7();
  const ownerAEmail = `billing-owner-a-${tenantA}@example.com`;
  const viewerAEmail = `billing-viewer-a-${tenantA}@example.com`;
  const ownerBEmail = `billing-owner-b-${tenantB}@example.com`;

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
      trx.insertInto('tenants').values({ id: tenantA, name: 'Billing Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Billing Tenant B' }).execute(),
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
  const currentYear = new Date().getFullYear();

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

  async function newShipment(token: string): Promise<string> {
    const response = await server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ reference: `BILL-${uuidv7()}`, clientName: 'Kafue Metals Ltd', type: 'import' })
      .expect(201);
    return response.body.id as string;
  }

  const dutyLine = {
    chargeType: 'customs_duty',
    description: 'Duty',
    quantity: 1,
    unitAmountMinor: 500_000,
  };
  const feeLine = {
    chargeType: 'agency_fee',
    description: 'Clearance fee',
    quantity: 1,
    unitAmountMinor: 100_000,
  };

  async function createQuote(token: string, shipmentId: string, ref = `Q-${uuidv7()}`) {
    const response = await server()
      .post(`/api/v1/shipments/${shipmentId}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reference: ref, currency: 'ZMW', lines: [dutyLine, feeLine] })
      .expect(201);
    return response.body;
  }

  it('prices a quote and taxes only the service fee', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const quote = await createQuote(token, shipmentId);

    expect(quote).toMatchObject({
      status: 'draft',
      currency: 'ZMW',
      vatRateBp: 1600,
      subtotalMinor: 600_000,
      taxMinor: 16_000,
      totalMinor: 616_000,
    });
    expect(quote.lines).toHaveLength(2);
    expect(
      quote.lines.find((l: { chargeType: string }) => l.chargeType === 'customs_duty').taxMinor,
    ).toBe(0);
    expect(
      quote.lines.find((l: { chargeType: string }) => l.chargeType === 'agency_fee').taxMinor,
    ).toBe(16_000);
  });

  it('rejects unknown and non-selectable charge types', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);

    await server()
      .post(`/api/v1/shipments/${shipmentId}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        reference: `Q-${uuidv7()}`,
        lines: [
          { chargeType: 'not_a_charge', description: 'x', quantity: 1, unitAmountMinor: 100 },
        ],
      })
      .expect(400);

    await server()
      .post(`/api/v1/shipments/${shipmentId}/quotes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        reference: `Q-${uuidv7()}`,
        lines: [
          { chargeType: 'vat', description: 'manual vat', quantity: 1, unitAmountMinor: 100 },
        ],
      })
      .expect(400);
  });

  it('moves a quote through its lifecycle and locks accepted quotes', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const quote = await createQuote(token, shipmentId);

    await server()
      .post(`/api/v1/quotes/${quote.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' })
      .expect(200);
    await server()
      .post(`/api/v1/quotes/${quote.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'accepted' })
      .expect(200);

    // An accepted quote can no longer be edited.
    await server()
      .patch(`/api/v1/quotes/${quote.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'too late' })
      .expect(409);

    // ...nor moved again.
    await server()
      .post(`/api/v1/quotes/${quote.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'declined' })
      .expect(409);
  });

  it('creates an invoice from an accepted quote and freezes the snapshot', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const quote = await createQuote(token, shipmentId);
    await server()
      .post(`/api/v1/quotes/${quote.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'accepted' })
      .expect(200);

    const invoice = await server()
      .post(`/api/v1/shipments/${shipmentId}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quoteId: quote.id })
      .expect(201);

    expect(invoice.body).toMatchObject({
      status: 'draft',
      currency: 'ZMW',
      totalMinor: 616_000,
      amountPaidMinor: 0,
      balanceMinor: 616_000,
    });
    expect(invoice.body.number).toMatch(new RegExp(`^INV-${currentYear}-\\d{4}$`));
    expect(invoice.body.lines).toHaveLength(2);

    // Issued documents are immutable: a non-draft invoice cannot be edited.
    await server()
      .post(`/api/v1/invoices/${invoice.body.id}/issue`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);
    await server()
      .patch(`/api/v1/invoices/${invoice.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'nope' })
      .expect(409);
  });

  it('records payments and derives the balance and status', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const quote = await createQuote(token, shipmentId);
    await server()
      .post(`/api/v1/quotes/${quote.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'accepted' })
      .expect(200);
    const invoice = (
      await server()
        .post(`/api/v1/shipments/${shipmentId}/invoices`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quoteId: quote.id, issueNow: true })
        .expect(201)
    ).body;
    expect(invoice.status).toBe('issued');

    const partial = await server()
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 200_000, method: 'bank_transfer', paidOn: '2026-02-01' })
      .expect(201);
    expect(partial.body.status).toBe('partially_paid');
    expect(partial.body.balanceMinor).toBe(416_000);

    const paid = await server()
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 416_000, method: 'cash', paidOn: '2026-02-02' })
      .expect(201);
    expect(paid.body.status).toBe('paid');
    expect(paid.body.balanceMinor).toBe(0);
    expect(paid.body.payments).toHaveLength(2);

    // A paid invoice cannot be voided.
    await server()
      .post(`/api/v1/invoices/${invoice.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'oops' })
      .expect(409);
  });

  it('voids an issued invoice with a reason and keeps it append-only', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const invoice = (
      await server()
        .post(`/api/v1/shipments/${shipmentId}/invoices`)
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [feeLine], issueNow: true })
        .expect(201)
    ).body;

    const voided = await server()
      .post(`/api/v1/invoices/${invoice.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Duplicate of another invoice' })
      .expect(200);
    expect(voided.body.status).toBe('void');
    expect(voided.body.voidReason).toBe('Duplicate of another invoice');
  });

  it('keeps payments append-only', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const invoice = (
      await server()
        .post(`/api/v1/shipments/${shipmentId}/invoices`)
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [feeLine], issueNow: true })
        .expect(201)
    ).body;
    const paid = await server()
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 10_000, method: 'cash', paidOn: '2026-02-03' })
      .expect(201);
    const paymentId = paid.body.payments[0].id as string;

    await expect(
      db.withTenant(tenantA, (trx) =>
        trx.updateTable('payments').set({ note: 'edit' }).where('id', '=', paymentId).execute(),
      ),
    ).rejects.toThrow();
  });

  it('allocates sequential per-tenant invoice numbers', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const first = (
      await server()
        .post(`/api/v1/shipments/${shipmentId}/invoices`)
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [feeLine] })
        .expect(201)
    ).body;
    const second = (
      await server()
        .post(`/api/v1/shipments/${shipmentId}/invoices`)
        .set('Authorization', `Bearer ${token}`)
        .send({ lines: [feeLine] })
        .expect(201)
    ).body;

    const n1 = Number(first.number.split('-')[2]);
    const n2 = Number(second.number.split('-')[2]);
    expect(n2).toBe(n1 + 1);
  });

  it('enforces least privilege for client viewers', async () => {
    const ownerToken = await tokenFor(ownerAEmail);
    const viewerToken = await tokenFor(viewerAEmail);
    const shipmentId = await newShipment(ownerToken);
    const quote = await createQuote(ownerToken, shipmentId);

    await server()
      .get(`/api/v1/quotes/${quote.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    await server()
      .post(`/api/v1/shipments/${shipmentId}/quotes`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ reference: `Q-${uuidv7()}`, lines: [feeLine] })
      .expect(403);
    await server()
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
  });

  it('isolates quotes and invoices between tenants', async () => {
    const ownerAToken = await tokenFor(ownerAEmail);
    const ownerBToken = await tokenFor(ownerBEmail);
    const shipmentId = await newShipment(ownerAToken);
    const quote = await createQuote(ownerAToken, shipmentId);

    await server()
      .get(`/api/v1/quotes/${quote.id}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    await server()
      .post(`/api/v1/shipments/${shipmentId}/invoices`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ quoteId: quote.id })
      .expect(404);
  });
});
