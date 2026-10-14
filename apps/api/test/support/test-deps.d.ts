/**
 * Minimal type shims for ESM-only test dependencies. The project type-checks
 * with the classic `node` module resolution, which cannot read the `exports`
 * maps of these packages. Only the surface used by the test helpers is typed.
 */
declare module 'embedded-postgres' {
  export interface PostgresOptions {
    databaseDir: string;
    port: number;
    user: string;
    password: string;
    persistent: boolean;
    onLog: (message: string) => void;
    onError: (error: unknown) => void;
  }

  export default class EmbeddedPostgres {
    constructor(options?: Partial<PostgresOptions>);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
  }
}

declare module 'node-pg-migrate' {
  export interface RunnerOption {
    databaseUrl: string;
    dir: string | string[];
    direction: 'up' | 'down';
    migrationsTable: string;
    count?: number;
    log?: (message: string) => void;
  }

  export function runner(options: RunnerOption): Promise<unknown>;
}
