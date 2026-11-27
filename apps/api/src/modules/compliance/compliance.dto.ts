import { z } from 'zod';
import type { CompliancePrompt, EstimateOutcome } from '@zclear/shared';

/** A user-entered value and HS code. No rate, duty or fee is client-supplied. */
export const estimateSchema = z
  .object({
    hsCode: z
      .string()
      .trim()
      .regex(/^\d{6,10}$/),
    customsValueMinor: z.number().int().nonnegative(),
    currency: z.enum(['ZMW', 'USD']),
  })
  .strict();

export type EstimateRequest = z.infer<typeof estimateSchema>;

export interface ComplianceAssistant {
  caseId: string;
  prompts: CompliancePrompt[];
  wordingSource: 'fixed' | 'ai';
  notice: string;
}

export type ComplianceEstimate = EstimateOutcome;
