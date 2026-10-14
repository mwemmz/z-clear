import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';
import { pino } from 'pino';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware';
import { ApiExceptionsFilter } from '../src/common/errors/api-exceptions.filter';
import { DatabaseService } from '../src/database/database.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { uuidv7 } from '../src/common/ids';

const PASSWORD = 'correct horse battery staple';
const MAX_BYTES = 1024;

// Collects the response body as a Buffer so binary downloads can be asserted.
function binaryParser(res: Response, callback: (error: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('documents (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const viewerA = uuidv7();
  const ownerB = uuidv7();
  const ownerAEmail = `owner-a-${tenantA}@example.com`;
  const viewerAEmail = `viewer-a-${tenantA}@example.com`;
  const ownerBEmail = `owner-b-${tenantB}@example.com`;

  beforeAll(async () => {
    process.env.MAX_UPLOAD_BYTES = String(MAX_BYTES);

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
      trx.insertInto('tenants').values({ id: tenantA, name: 'Docs Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Docs Tenant B' }).execute(),
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
    await db.withTenant(tenantA, (trx) =>
      trx
        .insertInto('document_requirements')
        .values([
          {
            id: uuidv7(),
            tenant_id: tenantA,
            shipment_type: 'import',
            doc_type: 'commercial_invoice',
            label: 'Commercial invoice',
            is_mandatory: true,
            sort_order: 1,
          },
          {
            id: uuidv7(),
            tenant_id: tenantA,
            shipment_type: 'import',
            doc_type: 'packing_list',
            label: 'Packing list',
            is_mandatory: true,
            sort_order: 2,
          },
          {
            id: uuidv7(),
            tenant_id: tenantA,
            shipment_type: 'import',
            doc_type: 'bill_of_lading',
            label: 'Bill of lading',
            is_mandatory: false,
            sort_order: 3,
          },
        ])
        .execute(),
    );
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.MAX_UPLOAD_BYTES;
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

  async function newShipment(token: string): Promise<string> {
    const response = await server()
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ reference: `REF-${uuidv7()}`, clientName: 'Kafue Metals Ltd', type: 'import' })
      .expect(201);
    return response.body.id as string;
  }

  async function addDocument(token: string, shipmentId: string, docType: string): Promise<string> {
    const response = await server()
      .post(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ docType, label: docType })
      .expect(201);
    return response.body.id as string;
  }

  it('lists the checklist and missing mandatory documents', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);

    const view = await server()
      .get(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(view.body.missing).toEqual(['commercial_invoice', 'packing_list']);
    expect(view.body.requirements).toHaveLength(3);
    expect(view.body.documents).toEqual([]);
  });

  it('adds a document, satisfies the checklist and rejects duplicates', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    await addDocument(token, shipmentId, 'commercial_invoice');

    const view = await server()
      .get(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(view.body.missing).toEqual(['packing_list']);
    expect(view.body.documents[0]).toMatchObject({
      docType: 'commercial_invoice',
      status: 'pending',
    });

    await server()
      .post(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ docType: 'commercial_invoice', label: 'again' })
      .expect(409);
  });

  it('uploads, marks the document uploaded, and streams the file back', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const documentId = await addDocument(token, shipmentId, 'commercial_invoice');
    const bytes = Buffer.from('%PDF-1.4 test invoice contents');

    const upload = await server()
      .post(`/api/v1/documents/${documentId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bytes, { filename: 'invoice.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(upload.body).toMatchObject({ originalName: 'invoice.pdf', scanStatus: 'skipped' });
    expect(upload.body.sizeBytes).toBe(bytes.byteLength);

    const view = await server()
      .get(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(view.body.documents[0].status).toBe('uploaded');
    expect(view.body.documents[0].files).toHaveLength(1);

    const download = await server()
      .get(`/api/v1/files/${upload.body.id as string}`)
      .set('Authorization', `Bearer ${token}`)
      .buffer()
      .parse(binaryParser)
      .expect(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(download.body as unknown as Buffer, bytes)).toBe(0);
  });

  it('rejects a disallowed file type and an oversized file', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const documentId = await addDocument(token, shipmentId, 'commercial_invoice');

    await server()
      .post(`/api/v1/documents/${documentId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('<html></html>'), {
        filename: 'x.html',
        contentType: 'text/html',
      })
      .expect(400);

    await server()
      .post(`/api/v1/documents/${documentId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.alloc(MAX_BYTES + 1, 1), {
        filename: 'big.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
  });

  it('blocks downloads of files that failed the scan', async () => {
    const token = await tokenFor(ownerAEmail);
    const shipmentId = await newShipment(token);
    const documentId = await addDocument(token, shipmentId, 'commercial_invoice');
    const upload = await server()
      .post(`/api/v1/documents/${documentId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4 ok'), {
        filename: 'ok.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    await db.withTenant(tenantA, (trx) =>
      trx
        .updateTable('files')
        .set({ scan_status: 'infected' })
        .where('id', '=', upload.body.id as string)
        .execute(),
    );

    await server()
      .get(`/api/v1/files/${upload.body.id as string}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('enforces least privilege: viewers read but cannot write or upload', async () => {
    const ownerToken = await tokenFor(ownerAEmail);
    const viewerToken = await tokenFor(viewerAEmail);
    const shipmentId = await newShipment(ownerToken);
    const documentId = await addDocument(ownerToken, shipmentId, 'commercial_invoice');

    await server()
      .get(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    await server()
      .post(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ docType: 'packing_list', label: 'Packing list' })
      .expect(403);
    await server()
      .post(`/api/v1/documents/${documentId}/files`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .attach('file', Buffer.from('%PDF-1.4 x'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);
  });

  it('isolates documents and files between tenants', async () => {
    const ownerAToken = await tokenFor(ownerAEmail);
    const ownerBToken = await tokenFor(ownerBEmail);
    const shipmentId = await newShipment(ownerAToken);
    const documentId = await addDocument(ownerAToken, shipmentId, 'commercial_invoice');
    const upload = await server()
      .post(`/api/v1/documents/${documentId}/files`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .attach('file', Buffer.from('%PDF-1.4 secret'), {
        filename: 's.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    await server()
      .get(`/api/v1/shipments/${shipmentId}/documents`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    await server()
      .get(`/api/v1/files/${upload.body.id as string}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
  });
});
