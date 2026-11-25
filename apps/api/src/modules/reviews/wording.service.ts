import { Inject, Injectable } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';

export interface ComposedWording {
  text: string;
  source: 'fixed' | 'ai';
}

export interface WordingSnapshot {
  shipment_reference: string;
  client_name: string;
  client_contact: string | null;
  shipment_type: string;
  origin: string | null;
  destination: string | null;
  consignment: Record<string, unknown>;
}

/**
 * Optional AI wording step for the review message the agent sends to the
 * importer. Gated behind FEATURE_AI; when it is off (the default) or the AI
 * step is unavailable, a fixed, deterministic template is used so behaviour
 * never depends on an external service.
 *
 * Safety posture (SECURITY.md, prompt injection): the model would receive
 * only the agent-composed message and structured snapshot fields — never
 * tools, never other shipments — and its output is treated as untrusted text
 * to be shown to the importer, not as instructions. Nothing here talks to
 * ASYCUDA or ZRA, and no duty/VAT/fee figures are ever generated.
 */
@Injectable()
export class WordingService {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  compose(snapshot: WordingSnapshot, agentMessage: string): ComposedWording {
    if (this.env.FEATURE_AI) {
      const ai = this.composeWithAi(snapshot, agentMessage);
      if (ai) return { text: ai, source: 'ai' };
    }
    return { text: this.fixedWording(snapshot, agentMessage), source: 'fixed' };
  }

  /**
   * Fixed fallback — deterministic, dependency-free wording. Kept boring on
   * purpose: it must read the same for the same inputs.
   */
  private fixedWording(snapshot: WordingSnapshot, agentMessage: string): string {
    const parts = [
      `Review request for shipment ${snapshot.shipment_reference}`,
      `Client: ${snapshot.client_name}`,
      `Type: ${snapshot.shipment_type}`,
      `Route: ${snapshot.origin || 'unknown'} to ${snapshot.destination || 'unknown'}`,
      '',
      agentMessage,
    ];
    return parts.join('\n');
  }


  /**
   * The AI step. No provider is wired in this phase: returning null always
   * falls back to the fixed wording, which keeps the feature flag honest and
   * the pipeline testable. A real implementation would call a model API with
   * a strict text-only schema and no tools.
   */
  private composeWithAi(_snapshot: WordingSnapshot, _agentMessage: string): string | null {
    return null;
  }
}
