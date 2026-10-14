import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../../common/errors/api-error';
import { TokenService } from '../auth/token.service';
import type { AuthenticatedRequest, AuthenticatedUser } from '../auth/auth.types';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';
import { roleHasPermissions, type Permission } from './permissions';

/**
 * Single global guard: authenticates every non-public route and enforces the
 * declared permissions. Deny by default — a route with neither @Public nor
 * @RequirePermissions is rejected, and a test guards against that at build time.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authenticate(request);
    request.user = user;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    if (!required || required.length === 0) {
      throw ApiError.forbidden('Endpoint declares no permissions');
    }
    if (!roleHasPermissions(user.role, required)) {
      throw ApiError.forbidden();
    }
    return true;
  }

  private async authenticate(request: AuthenticatedRequest): Promise<AuthenticatedUser> {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthenticated();
    }
    const claims = await this.tokens.verifyAccessToken(header.slice('Bearer '.length).trim());
    return { userId: claims.sub, tenantId: claims.tid, role: claims.role };
  }
}
