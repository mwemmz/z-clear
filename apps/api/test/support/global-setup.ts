import { startTestDatabase, type TestDatabase } from './test-db';

let database: TestDatabase | undefined;

/**
 * Boots a single throwaway PostgreSQL instance for the whole test run and
 * points the API at the non-owner application role. Runs in the main process
 * before any worker is forked, so `process.env` is inherited by every test.
 */
export async function setup(): Promise<void> {
  database = await startTestDatabase();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = database.appUrl;
  process.env.AUTH_JWT_SECRET = 'test-only-secret-test-only-secret-123456';
}

export async function teardown(): Promise<void> {
  await database?.stop();
  database = undefined;
}
