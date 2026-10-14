import { z } from 'zod';

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/**
 * Environment schema. Fail fast at boot with a readable error rather than
 * discovering a missing setting halfway through a request.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().max(65535).default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Optional so the API boots without a DB (health check, Phase 0 parity).
  DATABASE_URL: z.string().url().optional(),
  DATABASE_MIGRATION_URL: z.string().url().optional(),

  // Comma-separated list of allowed origins. Empty => same-origin only.
  CORS_ALLOWLIST: z.string().default(''),

  // Auth. In production AUTH_JWT_SECRET must be provided (see the refine below).
  AUTH_JWT_SECRET: z.string().min(32).default('dev-only-insecure-jwt-secret-please-override-32b'),
  AUTH_ACCESS_TOKEN_TTL: z.string().default('15m'),
  AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  COOKIE_SECURE: booleanish.default('false'),
  COOKIE_DOMAIN: z.string().optional(),

  NOTIFICATION_PROVIDER: z.enum(['mock', 'sms', 'whatsapp', 'email']).default('mock'),
  FEATURE_AI: booleanish.default('false'),
  FEATURE_NOTIFICATIONS: booleanish.default('false'),

  APP_VERSION: z.string().default('0.0.0'),
});

export type AppEnv = z.infer<typeof envSchema>;

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-please-override-32b';

export function corsOrigins(env: AppEnv): string[] {
  return env.CORS_ALLOWLIST.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.AUTH_JWT_SECRET === DEV_JWT_SECRET) {
      problems.push('AUTH_JWT_SECRET must be set to a strong, unique value in production.');
    }
    if (!env.DATABASE_URL) {
      problems.push('DATABASE_URL is required in production.');
    }
    if (problems.length > 0) {
      throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    }
  }

  return env;
}
