/**
 * Post-migration grants for the least-privilege application role.
 *
 * Migrations run as DATABASE_MIGRATION_URL (the schema owner). The API must
 * connect as a different, non-owner role or Postgres RLS is bypassed. Run this
 * after every migration so new tables and functions are covered too.
 *
 * Usage:
 *   DATABASE_MIGRATION_URL=postgresql://... \
 *     APP_DB_ROLE=zclear_app node dist/scripts/grant-app-role.js
 */
import 'dotenv/config';
import { Client } from 'pg';

/** Only simple identifiers are accepted; never interpolate arbitrary input. */
export function quoteRole(role: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(role)) {
    throw new Error('APP_DB_ROLE must be a simple PostgreSQL role name');
  }
  return `"${role}"`;
}

export function grantSql(role: string): string {
  const quoted = quoteRole(role);
  return `
    GRANT USAGE ON SCHEMA public TO ${quoted};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quoted};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${quoted};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoted};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${quoted};
  `;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error('DATABASE_MIGRATION_URL is required');
  const role = process.env.APP_DB_ROLE ?? 'app_user';
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(grantSql(role));
    console.log(`Grants applied to ${role}`);
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
