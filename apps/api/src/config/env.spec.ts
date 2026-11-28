import { describe, expect, it } from 'vitest';
import { corsOrigins, loadEnv } from './env';

describe('loadEnv', () => {
  it('applies safe defaults', () => {
    const env = loadEnv({} as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3000);
    expect(env.FEATURE_AI).toBe(false);
    expect(env.NOTIFICATION_PROVIDER).toBe('mock');
  });

  it('coerces numeric and boolean values', () => {
    const env = loadEnv({
      API_PORT: '8080',
      FEATURE_AI: 'true',
      NODE_ENV: 'test',
    } as NodeJS.ProcessEnv);
    expect(env.API_PORT).toBe(8080);
    expect(env.FEATURE_AI).toBe(true);
  });

  it('accepts the local SMS mock provider value in the enum', () => {
    expect(loadEnv({ NOTIFICATION_PROVIDER: 'sms_mock' }).NOTIFICATION_PROVIDER).toBe('sms_mock');
  });

  it('throws a readable error on invalid values', () => {
    expect(() => loadEnv({ API_PORT: 'not-a-port' } as NodeJS.ProcessEnv)).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('splits and trims the CORS allowlist', () => {
    const env = loadEnv({
      CORS_ALLOWLIST: 'https://a.test, https://b.test ,',
    } as NodeJS.ProcessEnv);
    expect(corsOrigins(env)).toEqual(['https://a.test', 'https://b.test']);
  });

  it('requires a strong hosted password when the one-shot seed flag is on in production', () => {
    const production = {
      NODE_ENV: 'production',
      AUTH_JWT_SECRET: 'a-strong-unique-jwt-secret-value',
      DATABASE_URL: 'postgresql://app:secret@localhost:5432/clearing',
      HOSTED_DEMO_SEED_ONCE: 'true',
    } as NodeJS.ProcessEnv;
    expect(() => loadEnv(production)).toThrow(/HOSTED_DEMO_PASSWORD/);
    const env = loadEnv({
      ...production,
      HOSTED_DEMO_PASSWORD: 'hosted-demo-password-value',
    } as NodeJS.ProcessEnv);
    expect(env.HOSTED_DEMO_SEED_ONCE).toBe(true);
    expect(loadEnv({ ...production, HOSTED_DEMO_SEED_ONCE: 'false' })).toMatchObject({
      HOSTED_DEMO_SEED_ONCE: false,
    });
  });
});
