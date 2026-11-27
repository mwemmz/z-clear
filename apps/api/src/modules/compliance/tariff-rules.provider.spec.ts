import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env';
import { TariffRulesProvider } from './tariff-rules.provider';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function writeRules(name: string, rules: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'zclear-tariff-'));
  dirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(rules), 'utf8');
  return path;
}

describe('TariffRulesProvider', () => {
  it('returns no rules when no configuration file is set', () => {
    expect(new TariffRulesProvider(loadEnv({})).all()).toEqual([]);
  });

  it('loads rules that carry full provenance', () => {
    const path = writeRules('rules.json', [
      {
        hsCode: '1102200000',
        description: 'Synthetic verified test rule',
        rateBp: 500,
        sourceUrl: 'https://example.com/source',
        effectiveDate: '2026-01-01',
        verificationStatus: 'VERIFIED',
      },
    ]);
    const provider = new TariffRulesProvider({ ...loadEnv({}), COMPLIANCE_RULES_FILE: path });
    expect(provider.all()).toMatchObject([
      { hsCode: '1102200000', verificationStatus: 'VERIFIED' },
    ]);
  });

  it('fails fast on a rule without a source URL or verification status', () => {
    const path = writeRules('bad.json', [
      { hsCode: '110220', description: 'No provenance', rateBp: 500 },
    ]);
    expect(
      () => new TariffRulesProvider({ ...loadEnv({}), COMPLIANCE_RULES_FILE: path }),
    ).toThrow();
  });
});
