import { Global, Module } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { APP_ENV } from '../config/config.module';
import type { AppEnv } from '../config/env';
import type { Database } from './database.types';
import { DatabaseService } from './database.service';
import { KYSELY, PG_POOL } from './database.tokens';

export { KYSELY, PG_POOL };

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_ENV],
      useFactory: (env: AppEnv): Pool | null =>
        env.DATABASE_URL ? new Pool({ connectionString: env.DATABASE_URL, max: 10 }) : null,
    },
    {
      provide: KYSELY,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null): Kysely<Database> | null =>
        pool ? new Kysely<Database>({ dialect: new PostgresDialect({ pool }) }) : null,
    },
    DatabaseService,
  ],
  exports: [DatabaseService, KYSELY, PG_POOL],
})
export class DatabaseModule {}
