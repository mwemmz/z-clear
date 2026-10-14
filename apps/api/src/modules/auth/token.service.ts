import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { isRole } from '../../common/roles';
import { ApiError } from '../../common/errors/api-error';
import type { AccessTokenClaims } from './auth.types';
import type { Role } from '../../common/roles';

export interface RefreshTokenPair {
  token: string;
  hash: string;
}

/**
 * Access tokens are short-lived signed JWTs (verified statelessly). Refresh
 * tokens are opaque random strings stored only as a SHA-256 hash, rotated on
 * every use and revocable server-side.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async issueAccessToken(userId: string, tenantId: string, role: Role): Promise<string> {
    const claims: AccessTokenClaims = { sub: userId, tid: tenantId, role, typ: 'access' };
    const expiresIn = this.env.AUTH_ACCESS_TOKEN_TTL as JwtSignOptions['expiresIn'];
    return this.jwt.signAsync(claims, { expiresIn });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw ApiError.unauthenticated('Invalid or expired token');
    }
    const claims = payload as Partial<AccessTokenClaims>;
    if (
      claims.typ !== 'access' ||
      typeof claims.sub !== 'string' ||
      typeof claims.tid !== 'string' ||
      typeof claims.role !== 'string' ||
      !isRole(claims.role)
    ) {
      throw ApiError.unauthenticated('Invalid token claims');
    }
    return { sub: claims.sub, tid: claims.tid, role: claims.role, typ: 'access' };
  }

  createRefreshToken(): RefreshTokenPair {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: hashRefreshToken(token) };
  }

  refreshExpiry(from = new Date()): Date {
    return new Date(from.getTime() + this.env.AUTH_REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
