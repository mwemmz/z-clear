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

  // Required from Phase 1 onward. Optional in Phase 0 so the API boots without a DB.
  DATABASE_URL: z.string().url().optional(),

  // Comma-separated list of allowed origins. Empty => same-origin only.
  CORS_ALLOWLIST: z.string().default(''),

  NOTIFICATION_PROVIDER: z.enum(['mock', 'sms', 'whatsapp', 'email']).default('mock'),
  FEATURE_AI: booleanish.default('false'),
  FEATURE_NOTIFICATIONS: booleanish.default('false'),

  APP_VERSION: z.string().default('0.0.0'),
});

export type AppEnv = z.infer<typeof envSchema>;

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
  return parsed.data;
}
