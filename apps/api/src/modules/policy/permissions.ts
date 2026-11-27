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
  // Drivers record a manual border check-in on the shipment assigned to them.
  'shipment:checkin',
  // Importers may open their own case before an agent is appointed. The
  // service always sets importer_user_id to the caller; no other role gets it.
  'case:create',
  // Importers read plain-language status answers for their own case only. The
  // service applies the importer scope to the underlying shipment lookup.
  'case:read',
  // Importers browse a curated, published directory and appoint an agent with
  // explicit consent. The tenant transfer itself is validated in the database.
  'agent_directory:read',
  'case:appoint',
  // Agencies publish their own directory profile.
  'agent_profile:manage',
  'document:read',
  'document:write',
  'file:read',
  'file:create',
  'quote:read',
  'quote:write',
  'invoice:read',
  'invoice:write',
  'payment:record',
  'export:create',
  'review:read',
  'review:send',
  'review:query',
  'review:approve',
  // Importers read the compliance assistant and request an illustrative
  // estimate. Both are read-only computations scoped to the caller's own case.
  'compliance:read',
  // Read-only delivery outcomes from the provider seam. No recipient address
  // is returned; importers are further scoped to their own outbox rows.
  'notification:read',
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
    'agent_profile:manage',
    'document:read',
    'document:write',
    'file:read',
    'file:create',
    'quote:read',
    'quote:write',
    'invoice:read',
    'invoice:write',
    'payment:record',
    'export:create',
    'review:read',
    'review:send',
    'review:query',
    'review:approve',
    'compliance:read',
    'notification:read',
    'self:read',
  ],
  agent_staff: [
    'tenant:read',
    'user:read',
    'agent_profile:manage',
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
    'export:create',
    'review:read',
    'review:send',
    'review:query',
    'review:approve',
    'compliance:read',
    'notification:read',
    'self:read',
  ],
  client_viewer: [
    'shipment:read',
    'case:create',
    'case:read',
    'agent_directory:read',
    'case:appoint',
    'document:read',
    'file:read',
    'quote:read',
    'invoice:read',
    // Importers read their assigned shipments' reviews and can query them,
    // but never send, revise or approve.
    'review:read',
    'review:query',
    'compliance:read',
    'notification:read',
    'self:read',
  ],
  platform_admin: [
    'tenant:read',
    'tenant:update',
    'agent_profile:manage',
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
    'export:create',
    'review:read',
    'review:send',
    'review:query',
    'review:approve',
    'compliance:read',
    'notification:read',
    'self:read',
  ],
  // Narrow role: see only shipments assigned to this driver and record a
  // manual check-in. No invoices, reviews, quotes, files or export access.
  driver: ['self:read', 'shipment:read', 'shipment:checkin'],
};

export function roleHasPermissions(role: Role, required: readonly Permission[]): boolean {
  const granted = ROLE_PERMISSIONS[role];
  return required.every((permission) => granted.includes(permission));
}
