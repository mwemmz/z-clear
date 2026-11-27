import { z } from 'zod';

/** Only curated, published fields are exposed in the shared directory. */
export interface AgentDirectoryEntry {
  id: string;
  userId: string;
  agencyName: string;
  location: string;
  serviceArea: string | null;
  languages: string | null;
  /** Always SIMULATED until a real ZRA source is verified. */
  licenceStatus: 'SIMULATED' | 'VERIFIED';
  licenceNotice: string;
}

export const createAgentProfileSchema = z
  .object({
    agencyName: z.string().trim().min(1).max(200),
    location: z.string().trim().min(1).max(200),
    serviceArea: z.string().trim().max(200).optional(),
    languages: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type CreateAgentProfileInput = z.infer<typeof createAgentProfileSchema>;

export interface AgentProfileView {
  id: string;
  agencyName: string;
  location: string;
  serviceArea: string | null;
  languages: string | null;
  notes: string | null;
  isPublished: boolean;
  licenceStatus: 'SIMULATED' | 'VERIFIED';
}

/**
 * Consent is explicit and recorded verbatim. The caller cannot choose which
 * importer is being transferred — that comes from the authenticated session.
 */
export const appointAgentSchema = z
  .object({
    caseId: z.string().uuid(),
    agentUserId: z.string().uuid(),
    consentText: z.string().trim().min(10).max(500),
  })
  .strict();

export type AppointAgentInput = z.infer<typeof appointAgentSchema>;

export interface AppointmentResult {
  agencyTenantId: string;
  /** The access token still carries the old tenant; sign in again. */
  mustReauthenticate: true;
}
