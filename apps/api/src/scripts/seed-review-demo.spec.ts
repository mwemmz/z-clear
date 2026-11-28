import { afterEach, describe, expect, it } from 'vitest';
import {
  DEMO_INVOICE,
  DEMO_LOGINS,
  DEMO_USERS,
  demoPassword,
  hostedDemoPassword,
  resolveSeedPassword,
} from './seed-review-demo';

const originalPassword = process.env.DEMO_PASSWORD;
const originalHostedPassword = process.env.HOSTED_DEMO_PASSWORD;
const originalNodeEnv = process.env.NODE_ENV;

describe('demo seed', () => {
  afterEach(() => {
    if (originalPassword === undefined) delete process.env.DEMO_PASSWORD;
    else process.env.DEMO_PASSWORD = originalPassword;
    if (originalHostedPassword === undefined) delete process.env.HOSTED_DEMO_PASSWORD;
    else process.env.HOSTED_DEMO_PASSWORD = originalHostedPassword;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('defines the four required demo logins with narrow synthetic identities', () => {
    expect(DEMO_LOGINS.map((user) => user.role)).toEqual([
      'agent_staff',
      'client_viewer',
      'platform_admin',
      'driver',
    ]);
    expect(DEMO_LOGINS.every((user) => user.email.endsWith('.example'))).toBe(true);
    expect(new Set(DEMO_LOGINS.map((user) => user.email)).size).toBe(DEMO_LOGINS.length);
    expect(new Set(DEMO_USERS.map((user) => user.id)).size).toBe(DEMO_USERS.length);
  });

  it('seeds only a labelled agency service amount, never a customs assessment', () => {
    expect(DEMO_INVOICE.amountMinor).toBeGreaterThan(0);
    expect(DEMO_INVOICE.note).toMatch(/agency clearance service fee only/);
    expect(DEMO_INVOICE.note).toMatch(/not a ZRA assessment/i);
    expect(DEMO_INVOICE.note).toMatch(/no duty or VAT/);
  });

  it('takes the local demo password only from the environment', () => {
    delete process.env.DEMO_PASSWORD;
    expect(() => demoPassword()).toThrow(/DEMO_PASSWORD/);
    process.env.DEMO_PASSWORD = 'short';
    expect(() => demoPassword()).toThrow(/DEMO_PASSWORD/);
    process.env.DEMO_PASSWORD = 'local-demo-password-value';
    expect(demoPassword()).toBe('local-demo-password-value');
  });

  it('requires a separate strong password for the hosted demo seed', () => {
    delete process.env.HOSTED_DEMO_PASSWORD;
    expect(() => hostedDemoPassword()).toThrow(/HOSTED_DEMO_PASSWORD/);
    process.env.HOSTED_DEMO_PASSWORD = 'short';
    expect(() => hostedDemoPassword()).toThrow(/HOSTED_DEMO_PASSWORD/);
    process.env.HOSTED_DEMO_PASSWORD = 'hosted-demo-password-value';
    expect(hostedDemoPassword()).toBe('hosted-demo-password-value');
  });

  it('uses the local password only outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEMO_PASSWORD = 'local-demo-password-value';
    expect(resolveSeedPassword({ hosted: false })).toBe('local-demo-password-value');
    expect(() => resolveSeedPassword({ hosted: false, nodeEnv: 'production' })).toThrow(
      /Refusing to seed demo data in production/,
    );
  });

  it('uses the hosted password only in explicit production mode', () => {
    process.env.HOSTED_DEMO_PASSWORD = 'hosted-demo-password-value';
    expect(resolveSeedPassword({ hosted: true, nodeEnv: 'production' })).toBe(
      'hosted-demo-password-value',
    );
    expect(() => resolveSeedPassword({ hosted: true, nodeEnv: 'development' })).toThrow(
      /requires NODE_ENV=production/,
    );
  });
});
