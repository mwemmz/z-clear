import { Inject, Injectable } from '@nestjs/common';
import type { CompliancePrompt } from '@zclear/shared';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';

/**
 * Optional AI wording for compliance prompts, gated behind FEATURE_AI. When it
 * is off (the default) or unavailable, the agency's fixed wording is returned
 * so behaviour never depends on an external service.
 *
 * A future model would see only prompt text: no personal data, no tools, no
 * money, no verification flags. It may reword text but cannot change provenance
 * or decide compliance. No model is wired in this phase.
 */
@Injectable()
export class ComplianceWordingService {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  reword(prompts: readonly CompliancePrompt[]): {
    prompts: CompliancePrompt[];
    source: 'fixed' | 'ai';
  } {
    if (this.env.FEATURE_AI) {
      const ai = this.rewordWithAi(prompts);
      if (ai) return { prompts: ai, source: 'ai' };
    }
    return { prompts: [...prompts], source: 'fixed' };
  }

  /** No provider is wired: null always falls back to fixed wording. */
  private rewordWithAi(_prompts: readonly CompliancePrompt[]): CompliancePrompt[] | null {
    return null;
  }
}
