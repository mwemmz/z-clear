import type { Role } from '../../common/roles';

/**
 * Permissions are the unit of authorization. Every non-public endpoint must
 * declare the permissions it needs; the access guard denies by default and a
 * test fails the build when an endpoint declares none.
 */
export const PERMISSIONS = [
  'tenant:read',
  'tenant:update',
  'user:read',
  'user:create',
  'user:update',
  'user:delete',
  'shipment:read',
  'shipment:create',
  'shipment:update',
  'shipment:stage',
  'document:read',
  'document:write',
  'file:read',
  'file:create',
  'quote:read',
  'quote:write',
  'invoice:read',
  'invoice:write',
  'payment:record',
  'self:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role -> permission matrix. `platform_admin` is intentionally tenant-scoped in
 * Phase 1: cross-tenant administration is a separate, audited path added later.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  agency_owner: [
    'tenant:read',
    'tenant:update',
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'shipment:read',
    'shipment:create',
    'shipment:update',
    'shipment:stage',
    'document:read',
    'document:write',
    'file:read',
    'file:create',
    'quote:read',
    'quote:write',
    'invoice:read',
    'invoice:write',
    'payment:record',
    'self:read',
  ],
  agent_staff: [
    'tenant:read',
    'user:read',
    'shipment:read',
    'shipment:create',
    'shipment:update',
    'shipment:stage',
    'document:read',
    'document:write',
    'file:read',
    'file:create',
    'quote:read',
    'quote:write',
    'invoice:read',
    'invoice:write',
    'payment:record',
    'self:read',
  ],
  client_viewer: [
    'shipment:read',
    'document:read',
    'file:read',
    'quote:read',
    'invoice:read',
    'self:read',
  ],
  platform_admin: [
    'tenant:read',
    'tenant:update',
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'shipment:read',
    'shipment:create',
    'shipment:update',
    'shipment:stage',
    'document:read',
    'document:write',
    'file:read',
    'file:create',
    'quote:read',
    'quote:write',
    'invoice:read',
    'invoice:write',
    'payment:record',
    'self:read',
  ],
};

export function roleHasPermissions(role: Role, required: readonly Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[role];
  return required.every((permission) => granted.includes(permission));
}
