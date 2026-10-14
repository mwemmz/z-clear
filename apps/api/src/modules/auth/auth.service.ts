import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import { isRole, type Role } from '../../common/roles';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from './auth.types';
import type { LoginResult, UserProfile } from './auth.dto';
import { PasswordService } from './password.service';
import { hashRefreshToken, TokenService } from './token.service';

interface LoginLookupRow {
  id: string;
  tenant_id: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
}

interface RefreshLookupRow {
  id: string;
  tenant_id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly db: DatabaseService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<LoginResult> {
    // SECURITY DEFINER function: authenticates before a tenant is known, since
    // RLS on `users` requires app.tenant_id to be set.
    const { rows } = await sql<LoginLookupRow>`
      select id, tenant_id, password_hash, role, is_active, failed_login_attempts, locked_until
      from auth_login_lookup(${email})
    `.execute(this.db.kysely);
    const user = rows[0];

    // Generic error everywhere: never reveal whether the account exists.
    if (!user) {
      throw ApiError.unauthenticated('Invalid email or password');
    }
    if (!user.is_active) {
      throw ApiError.unauthenticated('Invalid email or password');
    }
    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      throw ApiError.unauthenticated('Account temporarily locked. Try again later.');
    }

    const passwordOk = await this.passwords.verify(user.password_hash, password);
    if (!passwordOk) {
      await this.registerFailedLogin(user);
      throw ApiError.unauthenticated('Invalid email or password');
    }

    const role: Role = isRole(user.role) ? user.role : 'client_viewer';
    const { accessToken, refreshToken } = await this.issueSession(
      user.id,
      user.tenant_id,
      role,
      meta,
    );

    await this.db.withTenant(user.tenant_id, (trx) =>
      trx
        .updateTable('users')
        .set({ failed_login_attempts: 0, locked_until: null, updated_at: new Date() })
        .where('id', '=', user.id)
        .execute(),
    );

    await this.audit.record({
      tenantId: user.tenant_id,
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: this.toProfile(user.id, user.tenant_id, email, role),
    };
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<LoginResult> {
    if (!rawToken) {
      throw ApiError.unauthenticated('Missing refresh token');
    }
    const { rows } = await sql<RefreshLookupRow>`
      select id, tenant_id, user_id, expires_at, revoked_at
      from auth_refresh_lookup(${hashRefreshToken(rawToken)})
    `.execute(this.db.kysely);
    const stored = rows[0];
    if (!stored || stored.revoked_at || stored.expires_at.getTime() <= Date.now()) {
      throw ApiError.unauthenticated('Invalid refresh token');
    }

    const userRow = await this.db.withTenant(stored.tenant_id, (trx) =>
      trx
        .selectFrom('users')
        .select(['id', 'email', 'role', 'is_active'])
        .where('id', '=', stored.user_id)
        .executeTakeFirst(),
    );
    if (!userRow || !userRow.is_active) {
      throw ApiError.unauthenticated('Invalid refresh token');
    }
    const role: Role = isRole(userRow.role) ? userRow.role : 'client_viewer';

    const newPair = this.tokens.createRefreshToken();
    const newId = uuidv7();
    await this.db.withTenant(stored.tenant_id, async (trx) => {
      await trx
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date(), replaced_by: newId })
        .where('id', '=', stored.id)
        .execute();
      await trx
        .insertInto('refresh_tokens')
        .values({
          id: newId,
          tenant_id: stored.tenant_id,
          user_id: stored.user_id,
          token_hash: newPair.hash,
          expires_at: this.tokens.refreshExpiry(),
        })
        .execute();
    });

    const accessToken = await this.tokens.issueAccessToken(userRow.id, stored.tenant_id, role);
    await this.audit.record({
      tenantId: stored.tenant_id,
      actorUserId: userRow.id,
      action: 'auth.refresh',
      entityType: 'session',
      entityId: stored.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken: newPair.token,
      user: this.toProfile(userRow.id, stored.tenant_id, userRow.email, role),
    };
  }

  async logout(rawToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!rawToken) return;
    const { rows } = await sql<RefreshLookupRow>`
      select id, tenant_id, user_id, expires_at, revoked_at
      from auth_refresh_lookup(${hashRefreshToken(rawToken)})
    `.execute(this.db.kysely);
    const stored = rows[0];
    if (!stored || stored.revoked_at) return;

    await this.db.withTenant(stored.tenant_id, (trx) =>
      trx
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('id', '=', stored.id)
        .execute(),
    );
    await this.audit.record({
      tenantId: stored.tenant_id,
      actorUserId: stored.user_id,
      action: 'auth.logout',
      entityType: 'session',
      entityId: stored.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async me(actor: AuthenticatedUser): Promise<UserProfile> {
    const row = await this.db.withTenant(actor.tenantId, (trx) =>
      trx
        .selectFrom('users')
        .select(['id', 'tenant_id', 'email', 'role'])
        .where('id', '=', actor.userId)
        .executeTakeFirst(),
    );
    if (!row) {
      throw ApiError.notFound('User not found');
    }
    const role: Role = isRole(row.role) ? row.role : 'client_viewer';
    return this.toProfile(row.id, row.tenant_id, row.email, role);
  }

  async assertTenantIsActive(tenantId: string): Promise<void> {
    const tenant = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('tenants')
        .select('id')
        .where('id', '=', tenantId)
        .where('is_active', '=', true)
        .executeTakeFirst(),
    );
    if (!tenant) {
      throw ApiError.forbidden('Tenant is not active');
    }
  }

  private async registerFailedLogin(user: LoginLookupRow): Promise<void> {
    const attempts = user.failed_login_attempts + 1;
    const shouldLock = attempts >= this.env.AUTH_LOGIN_MAX_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + this.env.AUTH_LOGIN_LOCK_MINUTES * 60_000)
      : null;

    await this.db.withTenant(user.tenant_id, (trx) =>
      trx
        .updateTable('users')
        .set({ failed_login_attempts: attempts, locked_until: lockedUntil, updated_at: new Date() })
        .where('id', '=', user.id)
        .execute(),
    );
    await this.audit.record({
      tenantId: user.tenant_id,
      actorUserId: user.id,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: user.id,
      metadata: { attempts, locked: shouldLock },
    });
  }

  private async issueSession(
    userId: string,
    tenantId: string,
    role: Role,
    _meta: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.tokens.issueAccessToken(userId, tenantId, role);
    const pair = this.tokens.createRefreshToken();
    await this.db.withTenant(tenantId, (trx) =>
      trx
        .insertInto('refresh_tokens')
        .values({
          id: uuidv7(),
          tenant_id: tenantId,
          user_id: userId,
          token_hash: pair.hash,
          expires_at: this.tokens.refreshExpiry(),
        })
        .execute(),
    );
    return { accessToken, refreshToken: pair.token };
  }

  private toProfile(id: string, tenantId: string, email: string, role: Role): UserProfile {
    return { id, tenantId, email, role };
  }
}
