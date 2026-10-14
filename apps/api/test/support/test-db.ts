import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { runner } from 'node-pg-migrate';
import { Client } from 'pg';

const APP_ROLE = 'app_user';
const APP_PASSWORD = 'app_user';

/**
 * Mirrors production provisioning: the application connects as a dedicated
 * role that does NOT own the tables, so Row-Level Security actually applies
 * (a table owner bypasses its own RLS policies).
 */
const PROVISION_SQL = `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
      CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END $$;
  GRANT USAGE ON SCHEMA public TO ${APP_ROLE};
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APP_ROLE};
`;

export interface TestDatabase {
  /** Owner connection: runs migrations and provisioning only. */
  ownerUrl: string;
  /** Non-owner connection used by the app under test (RLS enforced). */
  appUrl: string;
  stop(): Promise<void>;
}

/**
 * Starts an ephemeral PostgreSQL cluster, applies all migrations with the owner
 * role, then provisions a non-owner application role. The cluster runs on a
 * random port and is torn down afterwards.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const port = 20_000 + Math.floor(Math.random() * 40_000);
  const databaseDir = mkdtempSync(join(tmpdir(), 'zra-pg-'));

  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();

  const ownerUrl = `postgresql://postgres:postgres@localhost:${port}/postgres`;

  await runner({
    databaseUrl: ownerUrl,
    dir: join(process.cwd(), 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  });

  const owner = new Client({ connectionString: ownerUrl });
  await owner.connect();
  try {
    await owner.query(PROVISION_SQL);
  } finally {
    await owner.end();
  }

  return {
    ownerUrl,
    appUrl: `postgresql://${APP_ROLE}:${APP_PASSWORD}@localhost:${port}/postgres`,
    stop: async () => {
      try {
        await pg.stop();
      } catch {
        // embedded-postgres removes its data directory on shutdown; Windows can
        // hold a file handle briefly and make that removal throw EBUSY. The
        // server is already stopped and the directory is disposable, so this is
        // not fatal.
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          rmSync(databaseDir, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    },
  };
}
