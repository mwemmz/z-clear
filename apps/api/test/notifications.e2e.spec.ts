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
import { AuditService } from '../src/modules/audit/audit.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { SmsMockNotificationProvider } from '../src/modules/notifications/notification.provider';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { uuidv7 } from '../src/common/ids';

const PASSWORD = 'correct horse battery staple';

describe('notifications (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const staffA = uuidv7();
  const importerA = uuidv7();
  const ownerB = uuidv7();
  const shipmentA = uuidv7();

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
      [tenantA, 'Notify Tenant A'],
      [tenantB, 'Notify Tenant B'],
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
            email: `notify-owner-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'agency_owner',
            phone: '+260970000001',
          },
          {
            id: staffA,
            tenant_id: tenantA,
            email: `notify-staff-a-${tenantA}@example.com`,
            password_hash: hash,
            role: 'agent_staff',
          },
          {
            id: importerA,
            tenant_id: tenantA,
            email: `notify-importer-a-${tenantA}@example.com`,
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
          email: `notify-owner-b-${tenantB}@example.com`,
          password_hash: hash,
          role: 'agency_owner',
        })
        .execute(),
    );
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('shipments')
        .values({
          id: shipmentA,
          tenant_id: tenantA,
          reference: `NOTIFY-${shipmentA}`,
          client_name: 'Synthetic Importer Ltd',
          type: 'import',
          importer_user_id: importerA,
        })
        .execute(),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  const server = () => request(app.getHttpServer());

  async function tokenFor(email: string): Promise<string> {
    const response = await server()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  it('appends one outcome per resolved recipient and an audit entry', async () => {
    await app.get(NotificationsService).emit({
      tenantId: tenantA,
      shipmentId: shipmentA,
      eventType: 'test.event',
      entityType: 'shipment',
      entityId: shipmentA,
      subject: 'Synthetic subject',
      body: 'Synthetic body',
      audience: 'both',
      meta: { ip: '127.0.0.1', userAgent: 'test' },
    });

    const rows = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('notification_outbox')
        .select(['recipient_user_id', 'recipient_email', 'status', 'channel'])
        .where('event_type', '=', 'test.event')
        .execute(),
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.recipient_user_id).sort()).toEqual(
      [ownerA, staffA, importerA].sort(),
    );
    expect(rows.every((row) => row.status === 'skipped')).toBe(true);
    expect(rows.every((row) => row.channel === 'mock')).toBe(true);

    const audit = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('audit_logs')
        .select('metadata')
        .where('action', '=', 'notification.emitted')
        .where('entity_id', '=', shipmentA)
        .execute(),
    );
    expect(audit).toHaveLength(1);
    expect((audit[0]?.metadata as { recipientCount: number }).recipientCount).toBe(3);
  });

  it('SMS mock records the phone from tenant data and skips users without one', async () => {
    const smsService = new NotificationsService(
      db,
      app.get(AuditService),
      new SmsMockNotificationProvider(),
    );
    await smsService.emit({
      tenantId: tenantA,
      shipmentId: shipmentA,
      eventType: 'test.sms_mock.event',
      entityType: 'shipment',
      entityId: shipmentA,
      subject: 'Synthetic SMS subject',
      body: 'Synthetic SMS body',
      audience: 'both',
      meta: { ip: '127.0.0.1', userAgent: 'test' },
    });

    const rows = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('notification_outbox')
        .select(['recipient_user_id', 'recipient_phone', 'status', 'channel', 'detail'])
        .where('event_type', '=', 'test.sms_mock.event')
        .execute(),
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.channel === 'sms_mock')).toBe(true);
    expect(rows.every((row) => row.status === 'skipped')).toBe(true);

    const ownerRow = rows.find((row) => row.recipient_user_id === ownerA);
    expect(ownerRow?.recipient_phone).toBe('+260970000001');
    expect(ownerRow?.detail).toMatch(/interface only/);

    const withoutPhone = rows.filter((row) => row.recipient_user_id !== ownerA);
    expect(withoutPhone.every((row) => row.recipient_phone === null)).toBe(true);
    expect(withoutPhone.every((row) => row.detail?.includes('no phone number on file'))).toBe(true);
  });

  it('never resolves a recipient from another tenant', async () => {
    const rows = await db.withTenant(tenantB, (trx) =>
      trx.selectFrom('notification_outbox').selectAll().execute(),
    );
    expect(rows).toHaveLength(0);
  });

  it('emits on invoice issue through the HTTP endpoint', async () => {
    const token = await tokenFor(`notify-owner-a-${tenantA}@example.com`);
    const created = await server()
      .post(`/api/v1/shipments/${shipmentA}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        lines: [
          {
            chargeType: 'agency_fee',
            description: 'Clearance fee',
            quantity: 1,
            unitAmountMinor: 100_000,
          },
        ],
      })
      .expect(201);
    const invoiceId = created.body.id as string;

    await server()
      .post(`/api/v1/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const rows = await db.withTenant(tenantA, (trx) =>
      trx
        .selectFrom('notification_outbox')
        .select(['event_type', 'entity_id', 'recipient_user_id'])
        .where('event_type', '=', 'invoice.issued')
        .execute(),
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.entity_id === invoiceId)).toBe(true);
  });
});
