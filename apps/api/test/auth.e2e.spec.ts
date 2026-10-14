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

function refreshCookieFrom(response: request.Response): string {
  const raw = response.headers['set-cookie'] as unknown as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = cookies.find((value) => value.startsWith('refresh_token='));
  if (!cookie) throw new Error('refresh cookie was not set');
  return cookie;
}

describe('auth (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let passwords: PasswordService;

  const tenantA = uuidv7();
  const tenantB = uuidv7();
  const ownerA = uuidv7();
  const viewerA = uuidv7();
  const ownerB = uuidv7();
  const ownerAEmail = `owner-a-${tenantA}@example.com`;
  const viewerAEmail = `viewer-a-${tenantA}@example.com`;
  const ownerBEmail = `owner-b-${tenantB}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new ApiExceptionsFilter(pino({ level: 'silent' })));
    await app.init();

    db = app.get(DatabaseService);
    passwords = app.get(PasswordService);
    const hash = await passwords.hash(PASSWORD);

    await db.withTenant(tenantA, (trx) =>
      trx.insertInto('tenants').values({ id: tenantA, name: 'Auth Tenant A' }).execute(),
    );
    await db.withTenant(tenantB, (trx) =>
      trx.insertInto('tenants').values({ id: tenantB, name: 'Auth Tenant B' }).execute(),
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

  function login(email: string, password = PASSWORD): request.Test {
    return server().post('/api/v1/auth/login').send({ email, password });
  }

  it('rejects bad credentials with a generic 401', async () => {
    const response = await login(ownerAEmail, 'wrong-password').expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.message).toBe('Invalid email or password');
  });

  it('logs in and sets an HttpOnly refresh cookie', async () => {
    const response = await login(ownerAEmail).expect(200);
    expect(response.body.accessToken).toBeTypeOf('string');
    expect(response.body.user).toMatchObject({
      id: ownerA,
      tenantId: tenantA,
      role: 'agency_owner',
    });

    const cookie = refreshCookieFrom(response);
    expect(cookie).toContain('refresh_token=');
    expect(response.headers['set-cookie']?.toString()).toContain('HttpOnly');
  });

  it('returns the current profile for a valid access token', async () => {
    const login2 = await login(ownerAEmail).expect(200);
    const profile = await server()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login2.body.accessToken as string}`)
      .expect(200);
    expect(profile.body).toMatchObject({ email: ownerAEmail, tenantId: tenantA });
  });

  it('requires authentication for protected routes', async () => {
    await server().get('/api/v1/auth/me').expect(401);
  });

  it('rotates the refresh token and invalidates the previous one', async () => {
    const first = await login(ownerAEmail).expect(200);
    const firstCookie = refreshCookieFrom(first);

    const rotated = await server()
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);
    expect(rotated.body.accessToken).toBeTypeOf('string');
    expect(refreshCookieFrom(rotated)).not.toBe(firstCookie);

    const reused = await server().post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    expect(reused.status).toBe(401);
  });

  it('revokes the refresh token on logout', async () => {
    const login3 = await login(ownerAEmail).expect(200);
    const cookie = refreshCookieFrom(login3);

    await server().post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    await server().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('enforces least privilege for client_viewer', async () => {
    const viewer = await login(viewerAEmail).expect(200);
    const token = viewer.body.accessToken as string;

    await server().get('/api/v1/users').set('Authorization', `Bearer ${token}`).expect(403);
    await server().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('lets an agency_owner manage users within their tenant only', async () => {
    const owner = await login(ownerAEmail).expect(200);
    const token = owner.body.accessToken as string;

    const list = await server()
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((user: { tenantId?: string; id: string }) => user.id)).toContain(ownerA);

    const created = await server()
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `staff-${tenantA}@example.com`, password: PASSWORD, role: 'agent_staff' })
      .expect(201);
    expect(created.body).toMatchObject({ role: 'agent_staff', isActive: true });

    const otherTenant = await login(ownerBEmail).expect(200);
    const otherList = await server()
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${otherTenant.body.accessToken as string}`)
      .expect(200);
    expect(otherList.body).toHaveLength(1);
    expect(otherList.body[0].id).toBe(ownerB);
  });
});
