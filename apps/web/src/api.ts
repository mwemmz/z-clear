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
import {
  SAMPLE_ROLE_LABELS,
  SAMPLE_ROLES,
  resetSampleWorkspace,
  sampleApi,
  sampleUser,
  type SampleRole,
} from './simulation';

export { SAMPLE_ROLE_LABELS, SAMPLE_ROLES, type SampleRole };

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
const SAMPLE_TOKEN_PREFIX = 'sample:';

/** Sample tokens are role-only. They carry no email, password or customer data. */
export function isSampleToken(token: string): boolean {
  return token.startsWith(SAMPLE_TOKEN_PREFIX);
}

export function sampleRoleFromToken(token: string): SampleRole | null {
  if (!isSampleToken(token)) return null;
  const role = token.slice(SAMPLE_TOKEN_PREFIX.length);
  return SAMPLE_ROLES.find((item) => item === role) ?? null;
}

/** Routes a method to the simulated workspace only for a sample token. */
function sampleOnly<T>(
  token: string,
  run: (role: SampleRole, userId: string) => Promise<T>,
  live: () => Promise<T>,
): Promise<T> {
  const role = sampleRoleFromToken(token);
  if (!role) return live();
  return run(role, sampleUser(role).id);
}

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
  driverUserId?: string | null;
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

/** Full review row returned by send, revise and approve endpoints. */
export type ReviewActionResult = AgentReviewSummary;

export interface UpdateStageInput {
  stage: ShipmentStatus;
  note?: string;
  holdReason?: string;
}

/** Staff inbox view backed by GET /reviews; no rating or directory data here. */
export interface AgentReviewSummary {
  id: string;
  shipmentId: string;
  revision: number;
  state: ImporterReviewState;
  message: string | null;
  query: string | null;
  isStale: boolean;
  allowedActions: ImporterReviewAction[];
  createdAt: string;
  updatedAt: string;
}

/** Append-only delivery outcome. The API never returns a recipient address. */
export interface NotificationView {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  channel: 'email' | 'mock' | 'sms_mock';
  status: 'sent' | 'skipped' | 'failed';
  detail: string | null;
  subject: string;
  createdAt: string;
}

/** Agency-owned setup guidance; never seeded with official requirements. */
export interface RegistryGuidanceView {
  id: string;
  stepKey: string;
  title: string;
  detail: string | null;
  sortOrder: number;
  isActive: boolean;
  sourceUrl: string | null;
  effectiveDate: string | null;
  verificationStatus: 'NEEDS_VERIFICATION' | 'VERIFIED' | 'SUPERSEDED';
  isVerified: boolean;
}

/** Agency invoice and its recorded payments. Balances are derived, not edited. */
export interface InvoiceSummary {
  id: string;
  shipmentId: string;
  number: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';
  currency: string;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  notes: string | null;
  vatVerificationStatus: string;
  issuedAt: string | null;
  lines: Array<{
    chargeType: string;
    description: string;
    lineAmountMinor: number;
  }>;
  payments: Array<{
    id: string;
    amountMinor: number;
    method: string;
    reference: string | null;
    paidOn: string;
    note: string | null;
  }>;
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
  /** Enters the in-memory workspace with a role only — no credentials. */
  loginSample(role: SampleRole): Promise<LoginResponse> {
    return Promise.resolve({
      accessToken: `${SAMPLE_TOKEN_PREFIX}${role}`,
      user: sampleUser(role),
    });
  },

  resetSample(): Promise<void> {
    resetSampleWorkspace();
    return Promise.resolve();
  },

  login(email: string, password: string): Promise<LoginResponse> {
    return request('/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me(token: string): Promise<UserProfile> {
    return sampleOnly(
      token,
      (role) => sampleApi.me(role),
      () => request('/auth/me', token),
    );
  },

  listShipments(token: string): Promise<ShipmentSummary[]> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.listShipments(role, userId),
      () => request('/shipments?limit=50', token),
    );
  },

  getShipment(token: string, id: string): Promise<ShipmentDetail> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.getShipment(role, userId, id),
      () => request(`/shipments/${encodeURIComponent(id)}`, token),
    );
  },

  updateShipmentStage(
    token: string,
    shipmentId: string,
    input: UpdateStageInput,
  ): Promise<ShipmentSummary> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.updateStage(role, userId, shipmentId, input),
      () =>
        request(`/shipments/${encodeURIComponent(shipmentId)}/stage`, token, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
    );
  },

  checkInShipment(
    token: string,
    shipmentId: string,
    input: { borderPost: string; note?: string },
  ): Promise<ShipmentEventSummary> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.checkIn(role, userId, shipmentId, input),
      () =>
        request(`/shipments/${encodeURIComponent(shipmentId)}/check-in`, token, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
    );
  },

  listReviews(token: string, shipmentId?: string): Promise<AgentReviewSummary[]> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.listReviews(role, userId, shipmentId),
      () => {
        const query = new URLSearchParams({ limit: '50' });
        if (shipmentId) query.set('shipmentId', shipmentId);
        return request(`/reviews?${query.toString()}`, token);
      },
    );
  },

  approveReview(token: string, reviewId: string): Promise<ReviewActionResult> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.approveReview(role, userId, reviewId),
      () =>
        request(`/reviews/${encodeURIComponent(reviewId)}/approve`, token, {
          method: 'POST',
        }),
    );
  },

  sendReview(token: string, shipmentId: string, message: string): Promise<ReviewActionResult> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.sendReview(role, userId, shipmentId, message),
      () =>
        request(`/shipments/${encodeURIComponent(shipmentId)}/review/send`, token, {
          method: 'POST',
          body: JSON.stringify({ message }),
        }),
    );
  },

  reviseReview(token: string, reviewId: string, newMessage: string): Promise<ReviewActionResult> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.reviseReview(role, userId, reviewId, newMessage),
      () =>
        request(`/reviews/${encodeURIComponent(reviewId)}/revise`, token, {
          method: 'POST',
          body: JSON.stringify({ newMessage }),
        }),
    );
  },

  listNotifications(token: string): Promise<NotificationView[]> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.listNotifications(role, userId),
      () => request('/notifications?limit=50', token),
    );
  },

  listGuidance(token: string): Promise<RegistryGuidanceView[]> {
    return sampleOnly(
      token,
      (_role) => sampleApi.listGuidance(),
      () => request('/guidance', token),
    );
  },

  listInvoices(token: string): Promise<InvoiceSummary[]> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.listInvoices(role, userId),
      () => request('/invoices?limit=50', token),
    );
  },

  recordPayment(
    token: string,
    invoiceId: string,
    input: {
      amountMinor: number;
      method: 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other';
      reference?: string;
      paidOn: string;
      note?: string;
    },
  ): Promise<InvoiceSummary> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.recordPayment(role, userId, invoiceId, input),
      () =>
        request(`/invoices/${encodeURIComponent(invoiceId)}/payments`, token, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
    );
  },

  createCase(token: string, input: CreateCaseInput): Promise<ShipmentSummary> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.createCase(role, userId, input),
      () =>
        request('/cases', token, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
    );
  },

  getChecklist(token: string, caseId: string): Promise<PersonalisedChecklist> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.getChecklist(role, userId, caseId),
      () => request(`/cases/${encodeURIComponent(caseId)}/checklist`, token),
    );
  },

  getCaseStatus(token: string, caseId: string): Promise<CaseStatus> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.getCaseStatus(role, userId, caseId),
      () => request(`/cases/${encodeURIComponent(caseId)}/status`, token),
    );
  },

  getCaseValuation(token: string, caseId: string): Promise<CaseValuation> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.getCaseValuation(role, userId, caseId),
      () => request(`/cases/${encodeURIComponent(caseId)}/valuation`, token),
    );
  },

  queryReview(token: string, reviewId: string, message: string): Promise<ReviewQueryResult> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.queryReview(role, userId, reviewId, message),
      () =>
        request(`/reviews/${encodeURIComponent(reviewId)}/query`, token, {
          method: 'POST',
          body: JSON.stringify({ message }),
        }),
    );
  },

  getComplianceAssistant(token: string, caseId: string): Promise<ComplianceAssistantResult> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.getComplianceAssistant(role, userId, caseId),
      () => request(`/compliance/assistant/${encodeURIComponent(caseId)}`, token),
    );
  },

  requestEstimate(
    token: string,
    input: { hsCode: string; customsValueMinor: number; currency: 'ZMW' | 'USD' },
  ): Promise<EstimateResult> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.requestEstimate(role, userId, input),
      () =>
        request('/compliance/estimate', token, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
    );
  },

  listAgentProfiles(token: string): Promise<AgentDirectoryEntry[]> {
    return sampleOnly(
      token,
      () => sampleApi.listAgentProfiles(),
      () => request('/agent-profiles', token),
    );
  },

  appointAgent(
    token: string,
    input: { caseId: string; agentUserId: string; consentText: string },
  ): Promise<AppointmentResult> {
    return sampleOnly(
      token,
      (role, userId) => sampleApi.appointAgent(role, userId, input),
      () =>
        request('/appointments', token, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
    );
  },
};

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
