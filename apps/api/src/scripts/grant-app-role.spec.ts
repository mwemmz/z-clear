import { describe, expect, it } from 'vitest';
import { grantSql, quoteRole } from './grant-app-role';

describe('grant-app-role', () => {
  it('quotes a simple role name', () => {
    expect(quoteRole('zclear_app')).toBe('"zclear_app"');
  });

  it('rejects anything that is not a simple identifier', () => {
    expect(() => quoteRole('x"; GRANT ALL ON ALL TABLES TO bad; --')).toThrow(/simple/);
  });

  it('grants DML on current and future tables but not ownership', () => {
    const sql = grantSql('zclear_app');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES');
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES');
    expect(sql).not.toContain('.OWNER TO');
  });
});
