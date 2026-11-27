import type {
  CaseStatusAnswer,
  CompliancePrompt,
  EstimateOutcome,
  ImporterReviewAction,
  ImporterReviewState,
  PersonalisedChecklist,
  RecordedValuation,
  ShipmentStatus,
  ShipmentType,
} from '@zclear/shared';

/**
 * Thin client for the existing /api/v1 endpoints. Deliberately small: the
 * prototype only needs sign-in, the current user's role, and a shipment case
 * file. No credentials or customer data are stored in this module.
 *
 * Locally the Vite dev server proxies /api to the API on port 3000. On Render
 * the static site is built with VITE_API_ORIGIN set to the API service URL,
 * so requests go straight to the deployed API.
 */
export function apiBase(): string {
  const origin = (import.meta.env.VITE_API_ORIGIN ?? '').trim().replace(/\/+$/, '');
  return `${origin}/api/v1`;
}

const API_BASE = apiBase();

export interface UserProfile {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface ShipmentSummary {
  id: string;
  reference: string;
  clientName: string;
  clientContact: string | null;
  type: ShipmentType;
  stage: ShipmentStatus;
  holdReason: string | null;
  origin: string | null;
  destination: string | null;
  consignment: Record<string, unknown>;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentEventSummary {
  id: string;
  fromStage: ShipmentStatus | null;
  toStage: ShipmentStatus;
  note: string | null;
  source: string;
  actorUserId: string | null;
  createdAt: string;
}

export interface ShipmentDetail extends ShipmentSummary {
  events: ShipmentEventSummary[];
}

export interface LoginResponse {
  accessToken: string;
  user: UserProfile;
}

export interface CreateCaseInput {
  clientName: string;
  clientContact: string;
  consignment: Record<string, unknown>;
}

/** Curated directory fields only: no contact details, TPIN or case data. */
export interface AgentDirectoryEntry {
  id: string;
  userId: string;
  agencyName: string;
  location: string;
  serviceArea: string | null;
  languages: string | null;
  licenceStatus: 'SIMULATED' | 'VERIFIED';
  licenceNotice: string;
}

export interface CaseStatus {
  caseId: string;
  answers: CaseStatusAnswer[];
  notice: string;
}

export interface CaseValuation {
  caseId: string;
  recorded: RecordedValuation | null;
  notice: string;
  review: {
    id: string;
    revision: number;
    state: ImporterReviewState;
    query: string | null;
    allowedActions: ImporterReviewAction[];
  } | null;
}

export interface ReviewQueryResult {
  id: string;
  revision: number;
  state: ImporterReviewState;
  query: string | null;
}

export interface ComplianceAssistantResult {
  caseId: string;
  prompts: CompliancePrompt[];
  wordingSource: 'fixed' | 'ai';
  notice: string;
}

export type EstimateResult = EstimateOutcome;

export interface AppointmentResult {
  agencyTenantId: string;
  mustReauthenticate: true;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(await errorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body.error?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  } catch {
    // A non-JSON error is still an error; fall back to the status below.
  }
  return `Request failed (${response.status})`;
}

export const api = {
  login(email: string, password: string): Promise<LoginResponse> {
    return request('/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me(token: string): Promise<UserProfile> {
    return request('/auth/me', token);
  },

  listShipments(token: string): Promise<ShipmentSummary[]> {
    return request('/shipments?limit=50', token);
  },

  getShipment(token: string, id: string): Promise<ShipmentDetail> {
    return request(`/shipments/${encodeURIComponent(id)}`, token);
  },

  createCase(token: string, input: CreateCaseInput): Promise<ShipmentSummary> {
    return request('/cases', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getChecklist(token: string, caseId: string): Promise<PersonalisedChecklist> {
    return request(`/cases/${encodeURIComponent(caseId)}/checklist`, token);
  },

  getCaseStatus(token: string, caseId: string): Promise<CaseStatus> {
    return request(`/cases/${encodeURIComponent(caseId)}/status`, token);
  },

  getCaseValuation(token: string, caseId: string): Promise<CaseValuation> {
    return request(`/cases/${encodeURIComponent(caseId)}/valuation`, token);
  },

  queryReview(token: string, reviewId: string, message: string): Promise<ReviewQueryResult> {
    return request(`/reviews/${encodeURIComponent(reviewId)}/query`, token, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  getComplianceAssistant(token: string, caseId: string): Promise<ComplianceAssistantResult> {
    return request(`/compliance/assistant/${encodeURIComponent(caseId)}`, token);
  },

  requestEstimate(
    token: string,
    input: { hsCode: string; customsValueMinor: number; currency: 'ZMW' | 'USD' },
  ): Promise<EstimateResult> {
    return request('/compliance/estimate', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  listAgentProfiles(token: string): Promise<AgentDirectoryEntry[]> {
    return request('/agent-profiles', token);
  },

  appointAgent(
    token: string,
    input: { caseId: string; agentUserId: string; consentText: string },
  ): Promise<AppointmentResult> {
    return request('/appointments', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
