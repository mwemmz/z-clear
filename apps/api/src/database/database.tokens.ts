/**
 * Injection tokens live in their own module so the service and the module can
 * both import them without creating a circular dependency (which would leave
 * the symbols undefined at decorator-evaluation time).
 */
export const PG_POOL = Symbol('PG_POOL');
export const KYSELY = Symbol('KYSELY');
