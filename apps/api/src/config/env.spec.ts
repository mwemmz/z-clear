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
});
