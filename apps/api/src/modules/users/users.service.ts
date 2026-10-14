import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { uuidv7 } from '../../common/ids';
import type { Role } from '../../common/roles';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import type { RequestMeta } from '../auth/auth.service';
import type { CreateUserInput, UpdateUserInput, UserSummary } from './users.dto';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string): Promise<UserSummary[]> {
    const rows = await this.db.withTenant(tenantId, (trx) =>
      trx
        .selectFrom('users')
        .select(['id', 'email', 'role', 'is_active', 'created_at'])
        .orderBy('created_at', 'asc')
        .execute(),
    );
    return rows.map(toSummary);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    input: CreateUserInput,
    meta: RequestMeta,
  ): Promise<UserSummary> {
    const passwordHash = await this.passwords.hash(input.password);
    const id = uuidv7();
    try {
      const row = await this.db.withTenant(tenantId, (trx) =>
        trx
          .insertInto('users')
          .values({
            id,
            tenant_id: tenantId,
            email: input.email,
            password_hash: passwordHash,
            role: input.role,
            created_by: actorUserId,
          })
          .returning(['id', 'email', 'role', 'is_active', 'created_at'])
          .executeTakeFirstOrThrow(),
      );
      await this.audit.record({
        tenantId,
        actorUserId,
        action: 'user.created',
        entityType: 'user',
        entityId: id,
        metadata: { role: input.role },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return toSummary(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict('A user with that email already exists');
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    userId: string,
    input: UpdateUserInput,
    meta: RequestMeta,
  ): Promise<UserSummary> {
    const passwordHash = input.password ? await this.passwords.hash(input.password) : undefined;
    try {
      const row = await this.db.withTenant(tenantId, (trx) =>
        trx
          .updateTable('users')
          .set({
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.role !== undefined ? { role: input.role } : {}),
            ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
            ...(passwordHash !== undefined ? { password_hash: passwordHash } : {}),
            updated_at: new Date(),
          })
          .where('id', '=', userId)
          .returning(['id', 'email', 'role', 'is_active', 'created_at'])
          .executeTakeFirst(),
      );
      if (!row) throw ApiError.notFound('User not found');

      await this.audit.record({
        tenantId,
        actorUserId,
        action: 'user.updated',
        entityType: 'user',
        entityId: userId,
        metadata: {
          fields: Object.keys(input),
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return toSummary(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ApiError.conflict('A user with that email already exists');
      }
      throw error;
    }
  }

  async remove(
    tenantId: string,
    actorUserId: string,
    userId: string,
    meta: RequestMeta,
  ): Promise<{ ok: true }> {
    if (userId === actorUserId) {
      throw ApiError.conflict('You cannot delete your own account');
    }
    const result = await this.db.withTenant(tenantId, (trx) =>
      trx.deleteFrom('users').where('id', '=', userId).executeTakeFirst(),
    );
    if (Number(result.numDeletedRows) === 0) {
      throw ApiError.notFound('User not found');
    }
    await this.audit.record({
      tenantId,
      actorUserId,
      action: 'user.deleted',
      entityType: 'user',
      entityId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: true };
  }
}

function toSummary(row: {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
}): UserSummary {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}
