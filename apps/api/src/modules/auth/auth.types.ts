import type { Request } from 'express';
import type { Role } from '../../common/roles';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface AccessTokenClaims {
  sub: string;
  tid: string;
  role: Role;
  typ: 'access';
}
