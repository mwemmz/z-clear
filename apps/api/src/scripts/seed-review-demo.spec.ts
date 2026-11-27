import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_LOGINS, DEMO_USERS, demoPassword } from './seed-review-demo';

const originalPassword = process.env.DEMO_PASSWORD;

describe('local demo seed', () => {
  afterEach(() => {
    if (originalPassword === undefined) delete process.env.DEMO_PASSWORD;
    else process.env.DEMO_PASSWORD = originalPassword;
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

  it('takes the demo password only from the environment', () => {
    delete process.env.DEMO_PASSWORD;
    expect(() => demoPassword()).toThrow(/DEMO_PASSWORD/);
    process.env.DEMO_PASSWORD = 'short';
    expect(() => demoPassword()).toThrow(/DEMO_PASSWORD/);
    process.env.DEMO_PASSWORD = 'local-demo-password-value';
    expect(demoPassword()).toBe('local-demo-password-value');
  });
});
