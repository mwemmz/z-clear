import { readFileSync } from 'node:fs';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { TariffRule } from '@zclear/shared';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';

/**
 * Tariff rules are external, versioned data — never invented in code. Every
 * rule must carry a source URL, effective date and verification status before
 * the estimator will consider it. Fail fast at boot on malformed data.
 */
const ruleSchema = z
  .object({
    hsCode: z.string().regex(/^\d{6,10}$/),
    description: z.string().trim().min(1).max(300),
    rateBp: z.number().int().nonnegative().max(100_000),
    sourceUrl: z.string().url(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    verificationStatus: z.enum(['NEEDS_VERIFICATION', 'VERIFIED', 'SUPERSEDED', 'SAMPLE']),
  })
  .strict();

@Injectable()
export class TariffRulesProvider {
  private readonly rules: readonly TariffRule[];

  constructor(@Inject(APP_ENV) env: AppEnv) {
    this.rules = loadRules(env.COMPLIANCE_RULES_FILE);
  }

  all(): readonly TariffRule[] {
    return this.rules;
  }
}

function loadRules(path: string | undefined): readonly TariffRule[] {
  if (!path) return [];
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Cannot read COMPLIANCE_RULES_FILE at ${path}: ${detail}`);
  }
  return z.array(ruleSchema).parse(JSON.parse(raw)) as TariffRule[];
}
