import {
  COMPLIANCE_ASSISTANT_NOTICE,
  COMPLIANCE_ESTIMATE_NOTICE,
  IMPORTER_REVIEW_STATE_LABELS,
  REVIEW_TRANSITIONS,
  caseStatusAnswers,
  compliancePrompts,
  personaliseChecklist,
  recordedValuation,
  type CaseKind,
  type ChecklistRule,
  type CompliancePrompt,
  type EstimateOutcome,
  type ImporterReviewAction,
  type ImporterReviewState,
} from '@zclear/shared';
import type {
  AgentDirectoryEntry,
  AgentReviewSummary,
  AppointmentResult,
  CaseStatus,
  CaseValuation,
  ComplianceAssistantResult,
  CreateCaseInput,
  InvoiceSummary,
  NotificationView,
  RegistryGuidanceView,
  ReviewQueryResult,
  ShipmentDetail,
  ShipmentEventSummary,
  ShipmentSummary,
  UserProfile,
} from './api';

/**
 * In-memory sample workspace. It mirrors the /api/v1 response shapes and never
 * sends a request. All identities are synthetic and clearly marked as samples;
 * nothing here is a ZRA figure or a live customs status.
 */

export const SAMPLE_ROLES = [
  'agency_owner',
  'agent_staff',
  'client_viewer',
  'platform_admin',
  'driver',
] as const;

export type SampleRole = (typeof SAMPLE_ROLES)[number];

export const SAMPLE_ROLE_LABELS: Record<SampleRole, string> = {
  agency_owner: 'Agency owner',
  agent_staff: 'Clearing agent',
  client_viewer: 'Importer / client',
  platform_admin: 'Platform admin',
  driver: 'Driver',
};

const AGENCY_TENANT = '10000000-0000-4000-8000-000000000001';
const IMPORTER_TENANT = '20000000-0000-4000-8000-000000000002';

const USERS: Record<SampleRole, UserProfile> = {
  agency_owner: {
    id: '00000000-0000-4000-8000-000000000011',
    tenantId: AGENCY_TENANT,
    email: 'owner@sample.invalid',
    role: 'agency_owner',
  },
  agent_staff: {
    id: '00000000-0000-4000-8000-000000000012',
    tenantId: AGENCY_TENANT,
    email: 'agent@sample.invalid',
    role: 'agent_staff',
  },
  client_viewer: {
    id: '00000000-0000-4000-8000-000000000021',
    tenantId: IMPORTER_TENANT,
    email: 'importer@sample.invalid',
    role: 'client_viewer',
  },
  platform_admin: {
    id: '00000000-0000-4000-8000-000000000013',
    tenantId: AGENCY_TENANT,
    email: 'admin@sample.invalid',
    role: 'platform_admin',
  },
  driver: {
    id: '00000000-0000-4000-8000-000000000014',
    tenantId: AGENCY_TENANT,
    email: 'driver@sample.invalid',
    role: 'driver',
  },
};

const AGENT_PROFILE_ID = '00000000-0000-4000-8000-000000000031';
const AGENT_USER_ID = '00000000-0000-4000-8000-000000000012';

interface StoredShipment extends ShipmentDetail {
  tenantId: string;
  importerUserId: string;
}

interface SampleState {
  shipments: StoredShipment[];
  reviews: AgentReviewSummary[];
  invoices: InvoiceSummary[];
  notifications: NotificationView[];
  guidance: RegistryGuidanceView[];
  agentProfiles: AgentDirectoryEntry[];
  checklistRules: ChecklistRule[];
  nextCase: number;
  nextInvoice: number;
  nextReview: number;
  seq: number;
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function uuid(seed: number): string {
  return `00000000-0000-4000-8000-${String(seed).padStart(12, '0')}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function summaryOf(shipment: StoredShipment): ShipmentSummary {
  const {
    events: _events,
    tenantId: _tenantId,
    importerUserId: _importerUserId,
    ...summary
  } = shipment;
  return clone(summary);
}

function detailOf(shipment: StoredShipment): ShipmentDetail {
  const { tenantId: _tenantId, importerUserId: _importerUserId, ...detail } = shipment;
  return clone(detail);
}

function event(
  id: string,
  fromStage: ShipmentDetail['stage'] | null,
  toStage: ShipmentDetail['stage'],
  note: string,
  actorUserId: string,
  createdAt: string,
): ShipmentEventSummary {
  return {
    id,
    fromStage,
    toStage,
    note,
    source: 'manual',
    actorUserId,
    createdAt,
  };
}

function rule(
  docType: string,
  label: string,
  sortOrder: number,
  satisfied: boolean,
): ChecklistRule {
  return {
    docType,
    label,
    isMandatory: true,
    sortOrder,
    caseKind: null,
    sourceUrl: null,
    effectiveDate: null,
    verificationStatus: 'NEEDS_VERIFICATION',
    satisfied,
  };
}

function seedState(): SampleState {
  const importerId = USERS.client_viewer.id;
  const agentId = USERS.agent_staff.id;

  const shipments: StoredShipment[] = [
    {
      id: uuid(101),
      tenantId: IMPORTER_TENANT,
      importerUserId: importerId,
      reference: 'ZCLR-2041',
      clientName: 'Kafue Metals Ltd (sample)',
      clientContact: '+260970000001',
      type: 'import',
      stage: 'in_transit',
      holdReason: null,
      origin: 'Dar es Salaam',
      destination: 'Lusaka',
      consignment: {
        caseKind: 'goods',
        goods: {
          description: 'Packaged maize flour (sample)',
          quantity: 40,
          unit: 'bags',
          valueMinor: 32_000_000,
          currency: 'ZMW',
          origin: 'Dar es Salaam',
          portOfEntry: 'Ndola',
        },
      },
      assignedAgentId: agentId,
      driverUserId: USERS.driver.id,
      createdAt: ago(60 * 24),
      updatedAt: ago(45),
      events: [
        event(uuid(201), null, 'docs_received', 'Sample documents received', agentId, ago(60 * 20)),
        event(
          uuid(202),
          'docs_received',
          'submitted',
          'Sample draft recorded',
          agentId,
          ago(60 * 12),
        ),
        event(uuid(203), 'submitted', 'duty_paid', 'Manual stage record', agentId, ago(60 * 5)),
        event(uuid(204), 'duty_paid', 'in_transit', 'Manual stage record', agentId, ago(45)),
      ],
    },
    {
      id: uuid(102),
      tenantId: IMPORTER_TENANT,
      importerUserId: importerId,
      reference: 'ZCLR-2038',
      clientName: 'Copperbelt Traders (sample)',
      clientContact: '+260970000002',
      type: 'import',
      stage: 'duty_assessed',
      holdReason: null,
      origin: 'Johannesburg',
      destination: 'Kitwe',
      consignment: {
        caseKind: 'goods',
        goods: {
          description: 'Motor spares (sample)',
          quantity: 12,
          unit: 'cartons',
          valueMinor: 18_500_000,
          currency: 'ZMW',
          origin: 'Johannesburg',
          portOfEntry: 'Kasumbalesa',
        },
      },
      assignedAgentId: agentId,
      driverUserId: null,
      createdAt: ago(60 * 15),
      updatedAt: ago(180),
      events: [
        event(uuid(205), null, 'docs_received', 'Sample documents received', agentId, ago(60 * 14)),
        event(uuid(206), 'docs_received', 'submitted', 'Manual stage record', agentId, ago(300)),
      ],
    },
    {
      id: uuid(103),
      tenantId: IMPORTER_TENANT,
      importerUserId: importerId,
      reference: 'ZCLR-2035',
      clientName: 'Sample Imports Co',
      clientContact: '+260970000003',
      type: 'import',
      stage: 'docs_received',
      holdReason: null,
      origin: 'Dubai',
      destination: 'Lusaka',
      consignment: {
        caseKind: 'goods',
        goods: {
          description: 'Household goods (sample)',
          quantity: 6,
          unit: 'packages',
          valueMinor: 9_400_000,
          currency: 'ZMW',
          origin: 'Dubai',
          portOfEntry: 'Lusaka',
        },
      },
      assignedAgentId: null,
      driverUserId: null,
      createdAt: ago(60 * 3),
      updatedAt: ago(60 * 3),
      events: [
        event(uuid(207), null, 'docs_received', 'Sample case opened', importerId, ago(60 * 3)),
      ],
    },
  ];

  const firstShipment = shipments[0]!;
  const secondShipment = shipments[1]!;

  const reviews: AgentReviewSummary[] = [
    {
      id: uuid(301),
      shipmentId: firstShipment.id,
      revision: 3,
      state: 'in_review',
      message: 'Please confirm the sample destination and value before the manual handoff.',
      query: null,
      isStale: false,
      allowedActions: [...REVIEW_TRANSITIONS.in_review],
      createdAt: ago(90),
      updatedAt: ago(90),
    },
    {
      id: uuid(302),
      shipmentId: secondShipment.id,
      revision: 1,
      state: 'draft',
      message: 'Sample draft awaiting agency review.',
      query: null,
      isStale: false,
      allowedActions: [...REVIEW_TRANSITIONS.draft],
      createdAt: ago(120),
      updatedAt: ago(120),
    },
  ];

  const invoices: InvoiceSummary[] = [
    {
      id: uuid(401),
      shipmentId: firstShipment.id,
      number: 'INV-S001',
      status: 'issued',
      currency: 'ZMW',
      totalMinor: 60_000,
      amountPaidMinor: 0,
      balanceMinor: 60_000,
      notes: 'Synthetic agency service fee only. Not a ZRA assessment; no duty or VAT included.',
      vatVerificationStatus: 'NEEDS_VERIFICATION',
      issuedAt: ago(80),
      lines: [
        {
          chargeType: 'agency_fee',
          description: 'Agency clearance service fee (sample)',
          lineAmountMinor: 60_000,
        },
      ],
      payments: [],
    },
  ];

  const notifications: NotificationView[] = [
    {
      id: uuid(501),
      eventType: 'review.sent',
      entityType: 'importer_review',
      entityId: reviews[0]!.id,
      channel: 'sms_mock',
      status: 'skipped',
      detail: 'SMS mock: interface only, nothing sent',
      subject: `Review ready for ${firstShipment.reference}`,
      createdAt: ago(90),
    },
  ];

  return {
    shipments,
    reviews,
    invoices,
    notifications,
    guidance: [
      {
        id: uuid(601),
        stepKey: 'agency_onboarding',
        title: 'Agency onboarding note',
        detail: 'Sample guidance from the agency. Confirm current requirements with ZRA.',
        sortOrder: 1,
        isActive: true,
        sourceUrl: null,
        effectiveDate: null,
        verificationStatus: 'NEEDS_VERIFICATION',
        isVerified: false,
      },
    ],
    agentProfiles: [
      {
        id: AGENT_PROFILE_ID,
        userId: AGENT_USER_ID,
        agencyName: 'Copperbelt Clearing (sample)',
        location: 'Ndola',
        serviceArea: 'Copperbelt',
        languages: 'English, Bemba',
        licenceStatus: 'SIMULATED',
        licenceNotice: 'Simulated profile, pending verification',
      },
    ],
    checklistRules: [
      rule('proof_of_purchase', 'Proof of purchase', 1, false),
      rule('packing_list', 'Packing list', 2, true),
      rule('importer_id', 'Importer identification', 3, false),
    ],
    nextCase: 4,
    nextInvoice: 402,
    nextReview: 303,
    seq: 700,
  };
}

let state = seedState();

export function resetSampleWorkspace(): void {
  state = seedState();
}

export function sampleUser(role: SampleRole): UserProfile {
  return clone(USERS[role]);
}

function requireRole(role: SampleRole, allowed: readonly SampleRole[]): void {
  if (!allowed.includes(role)) {
    throw new Error('This sample workspace role cannot perform that action.');
  }
}

function visibleShipments(role: SampleRole, userId: string): StoredShipment[] {
  if (role === 'client_viewer') {
    return state.shipments.filter((item) => item.importerUserId === userId);
  }
  if (role === 'driver') {
    return state.shipments.filter((item) => item.driverUserId === userId);
  }
  if (role === 'platform_admin') {
    return state.shipments;
  }
  return state.shipments.filter((item) => item.assignedAgentId !== null);
}

function findVisibleShipment(role: SampleRole, userId: string, shipmentId: string): StoredShipment {
  const shipment = visibleShipments(role, userId).find((item) => item.id === shipmentId);
  if (!shipment) throw new Error('Sample case not found for this role.');
  return shipment;
}

function nextId(prefix: string): string {
  state.seq += 1;
  return `${prefix}-${state.seq}`;
}

function notify(eventType: string, subject: string): void {
  state.notifications.unshift({
    id: uuid(state.seq++),
    eventType,
    entityType: null,
    entityId: null,
    channel: 'mock',
    status: 'sent',
    detail: 'Sample workspace event. Nothing was sent outside this browser.',
    subject,
    createdAt: new Date().toISOString(),
  });
}

function reviewSummaryOf(review: AgentReviewSummary): AgentReviewSummary {
  return clone(review);
}

function latestReview(shipmentId: string): AgentReviewSummary | undefined {
  return state.reviews
    .filter((review) => review.shipmentId === shipmentId)
    .sort((a, b) => b.revision - a.revision)[0];
}

function checklistFor(shipment: StoredShipment) {
  const caseKind = (shipment.consignment.caseKind === 'vehicle' ? 'vehicle' : 'goods') as CaseKind;
  return personaliseChecklist(state.checklistRules, caseKind);
}

function promptsFor(shipment: StoredShipment): CompliancePrompt[] {
  const value = recordedValuation(shipment.consignment);
  return compliancePrompts({
    rules: state.checklistRules,
    caseKind: (shipment.consignment.caseKind === 'vehicle' ? 'vehicle' : 'goods') as CaseKind,
    recordedValueFormatted: value?.formatted ?? null,
  });
}

function transition(
  review: AgentReviewSummary,
  action: ImporterReviewAction,
  patch: Partial<AgentReviewSummary>,
): void {
  if (!review.allowedActions.includes(action)) {
    throw new Error(`Sample review cannot be ${action}ed in its current state.`);
  }
  review.state = patch.state ?? review.state;
  review.allowedActions = [...REVIEW_TRANSITIONS[review.state as ImporterReviewState]];
  Object.assign(review, patch, {
    allowedActions: review.allowedActions,
    updatedAt: new Date().toISOString(),
  });
}

function findReview(reviewId: string): AgentReviewSummary {
  const review = state.reviews.find((item) => item.id === reviewId);
  if (!review) throw new Error('Sample review not found.');
  return review;
}

export const sampleApi = {
  me(role: SampleRole): Promise<UserProfile> {
    return Promise.resolve(sampleUser(role));
  },

  listShipments(role: SampleRole, userId: string): Promise<ShipmentSummary[]> {
    return Promise.resolve(visibleShipments(role, userId).map(summaryOf));
  },

  getShipment(role: SampleRole, userId: string, id: string): Promise<ShipmentDetail> {
    return Promise.resolve(detailOf(findVisibleShipment(role, userId, id)));
  },

  createCase(role: SampleRole, userId: string, input: CreateCaseInput): Promise<ShipmentSummary> {
    requireRole(role, ['client_viewer']);
    const index = state.nextCase++;
    const shipment: StoredShipment = {
      id: uuid(900 + index),
      tenantId: IMPORTER_TENANT,
      importerUserId: userId,
      reference: `ZCLR-${2000 + index}`,
      clientName: input.clientName,
      clientContact: input.clientContact,
      type: 'import',
      stage: 'docs_received',
      holdReason: null,
      origin: null,
      destination: null,
      consignment: clone(input.consignment),
      assignedAgentId: null,
      driverUserId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [
        event(
          uuid(950 + index),
          null,
          'docs_received',
          'Sample case opened by importer',
          userId,
          new Date().toISOString(),
        ),
      ],
    };
    state.shipments.unshift(shipment);
    notify('case.created', `Sample case ${shipment.reference} opened`);
    return Promise.resolve(summaryOf(shipment));
  },

  updateStage(
    role: SampleRole,
    userId: string,
    id: string,
    input: { stage: ShipmentDetail['stage']; note?: string; holdReason?: string },
  ): Promise<ShipmentSummary> {
    requireRole(role, ['agency_owner', 'agent_staff', 'platform_admin']);
    const shipment = findVisibleShipment(role, userId, id);
    const fromStage = shipment.stage;
    shipment.stage = input.stage;
    shipment.holdReason =
      input.stage === 'on_hold' ? (input.holdReason ?? 'Awaiting importer') : null;
    shipment.updatedAt = new Date().toISOString();
    shipment.events.unshift(
      event(
        nextId('evt'),
        fromStage,
        input.stage,
        input.note ?? input.holdReason ?? 'Manual stage record',
        userId,
        shipment.updatedAt,
      ),
    );
    notify('shipment.stage', `Sample case ${shipment.reference} moved to ${input.stage}`);
    return Promise.resolve(summaryOf(shipment));
  },

  checkIn(
    role: SampleRole,
    userId: string,
    id: string,
    input: { borderPost: string; note?: string },
  ): Promise<ShipmentEventSummary> {
    requireRole(role, ['driver']);
    const shipment = findVisibleShipment(role, userId, id);
    const created = event(
      nextId('evt'),
      shipment.stage,
      shipment.stage,
      `Border check-in at ${input.borderPost}${input.note ? ` — ${input.note}` : ''}`,
      userId,
      new Date().toISOString(),
    );
    shipment.events.unshift(created);
    shipment.updatedAt = created.createdAt;
    notify('shipment.check_in', `Sample check-in recorded for ${shipment.reference}`);
    return Promise.resolve(clone(created));
  },

  listReviews(
    role: SampleRole,
    userId: string,
    shipmentId?: string,
  ): Promise<AgentReviewSummary[]> {
    const visibleIds = new Set(visibleShipments(role, userId).map((item) => item.id));
    return Promise.resolve(
      state.reviews
        .filter((review) => visibleIds.has(review.shipmentId))
        .filter((review) => !shipmentId || review.shipmentId === shipmentId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(reviewSummaryOf),
    );
  },

  queryReview(
    role: SampleRole,
    userId: string,
    reviewId: string,
    message: string,
  ): Promise<ReviewQueryResult> {
    const review = findReview(reviewId);
    findVisibleShipment(role, userId, review.shipmentId);
    transition(review, 'query', { state: 'queried', query: message });
    notify('review.queried', `Sample review ${review.revision} queried`);
    return Promise.resolve({
      id: review.id,
      revision: review.revision,
      state: review.state,
      query: review.query,
    });
  },

  approveReview(role: SampleRole, userId: string, reviewId: string): Promise<AgentReviewSummary> {
    const review = findReview(reviewId);
    findVisibleShipment(role, userId, review.shipmentId);
    transition(review, 'approve', {
      state: 'approved',
      query: null,
    });
    notify('review.approved', `Sample review ${review.revision} approved`);
    return Promise.resolve(reviewSummaryOf(review));
  },

  sendReview(
    role: SampleRole,
    userId: string,
    shipmentId: string,
    message: string,
  ): Promise<AgentReviewSummary> {
    requireRole(role, ['agency_owner', 'agent_staff', 'platform_admin']);
    findVisibleShipment(role, userId, shipmentId);
    const previousRevision = state.reviews
      .filter((item) => item.shipmentId === shipmentId)
      .reduce((max, item) => Math.max(max, item.revision), 0);
    const index = state.nextReview++;
    const review: AgentReviewSummary = {
      id: uuid(index),
      shipmentId,
      revision: previousRevision + 1,
      state: 'in_review',
      message,
      query: null,
      isStale: false,
      allowedActions: [...REVIEW_TRANSITIONS.in_review],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.reviews.unshift(review);
    notify('review.sent', `Sample review sent for case ${shipmentId.slice(-4)}`);
    return Promise.resolve(reviewSummaryOf(review));
  },

  reviseReview(
    role: SampleRole,
    userId: string,
    reviewId: string,
    newMessage: string,
  ): Promise<AgentReviewSummary> {
    requireRole(role, ['agency_owner', 'agent_staff', 'platform_admin']);
    const previous = findReview(reviewId);
    findVisibleShipment(role, userId, previous.shipmentId);
    transition(previous, 'revise', {
      state: previous.state === 'in_review' ? 'queried' : previous.state,
    });
    const created: AgentReviewSummary = {
      id: uuid(state.nextReview++),
      shipmentId: previous.shipmentId,
      revision: previous.revision + 1,
      state: 'draft',
      message: newMessage,
      query: null,
      isStale: false,
      allowedActions: [...REVIEW_TRANSITIONS.draft],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.reviews.unshift(created);
    notify('review.revised', `Sample review revision ${created.revision} created`);
    return Promise.resolve(reviewSummaryOf(created));
  },

  listNotifications(role: SampleRole, userId: string): Promise<NotificationView[]> {
    const visibleIds = new Set(visibleShipments(role, userId).map((item) => item.id));
    const visibleReviewIds = new Set(
      state.reviews
        .filter((review) => visibleIds.has(review.shipmentId))
        .map((review) => review.id),
    );
    return Promise.resolve(
      clone(
        state.notifications.filter(
          (item) =>
            !item.entityId || visibleIds.has(item.entityId) || visibleReviewIds.has(item.entityId),
        ),
      ),
    );
  },

  listGuidance(): Promise<RegistryGuidanceView[]> {
    return Promise.resolve(clone(state.guidance));
  },

  listInvoices(role: SampleRole, userId: string): Promise<InvoiceSummary[]> {
    const visibleIds = new Set(visibleShipments(role, userId).map((item) => item.id));
    return Promise.resolve(clone(state.invoices.filter((item) => visibleIds.has(item.shipmentId))));
  },

  recordPayment(
    role: SampleRole,
    userId: string,
    invoiceId: string,
    input: {
      amountMinor: number;
      method: string;
      reference?: string;
      paidOn: string;
      note?: string;
    },
  ): Promise<InvoiceSummary> {
    requireRole(role, ['agency_owner', 'agent_staff', 'platform_admin']);
    const invoice = state.invoices.find((item) => item.id === invoiceId);
    if (
      !invoice ||
      !visibleShipments(role, userId).some((item) => item.id === invoice.shipmentId)
    ) {
      throw new Error('Sample invoice not found for this role.');
    }
    invoice.payments.push({
      id: nextId('pay'),
      amountMinor: input.amountMinor,
      method: input.method,
      reference: input.reference ?? null,
      paidOn: input.paidOn,
      note: input.note ?? null,
    });
    invoice.amountPaidMinor += input.amountMinor;
    invoice.balanceMinor = Math.max(0, invoice.totalMinor - invoice.amountPaidMinor);
    invoice.status =
      invoice.balanceMinor === 0
        ? 'paid'
        : invoice.amountPaidMinor > 0
          ? 'partially_paid'
          : 'issued';
    notify('invoice.payment', `Sample payment recorded for ${invoice.number}`);
    return Promise.resolve(clone(invoice));
  },

  getChecklist(role: SampleRole, userId: string, caseId: string) {
    const shipment = findVisibleShipment(role, userId, caseId);
    return Promise.resolve(clone(checklistFor(shipment)));
  },

  getCaseStatus(role: SampleRole, userId: string, caseId: string): Promise<CaseStatus> {
    const shipment = findVisibleShipment(role, userId, caseId);
    const checklist = checklistFor(shipment);
    const invoice = state.invoices.find((item) => item.shipmentId === caseId);
    return Promise.resolve({
      caseId,
      answers: caseStatusAnswers({
        stage: shipment.stage,
        holdReason: shipment.holdReason,
        invoices: invoice
          ? [
              {
                number: invoice.number,
                status: invoice.status,
                currency: 'ZMW',
                balanceMinor: invoice.balanceMinor,
              },
            ]
          : [],
        missingMandatory: checklist.missingMandatory.length,
      }),
      notice:
        'Stages are your agency’s manual record. Customs steps happen in ASYCUDA World; Z Clear does not assess duty or decide release.',
    });
  },

  getCaseValuation(role: SampleRole, userId: string, caseId: string): Promise<CaseValuation> {
    const shipment = findVisibleShipment(role, userId, caseId);
    const review = latestReview(caseId);
    return Promise.resolve({
      caseId,
      recorded: recordedValuation(shipment.consignment),
      notice:
        'This is the value recorded on your case, not a customs assessment. Z Clear does not decide customs value, assess duty or tax, or send anything to ZRA. Customs value is decided in ASYCUDA World.',
      review: review
        ? {
            id: review.id,
            revision: review.revision,
            state: review.state,
            query: review.query,
            allowedActions: [...review.allowedActions],
          }
        : null,
    });
  },

  getComplianceAssistant(
    role: SampleRole,
    userId: string,
    caseId: string,
  ): Promise<ComplianceAssistantResult> {
    const shipment = findVisibleShipment(role, userId, caseId);
    return Promise.resolve({
      caseId,
      prompts: promptsFor(shipment),
      wordingSource: 'fixed',
      notice: COMPLIANCE_ASSISTANT_NOTICE,
    });
  },

  requestEstimate(
    _role: SampleRole,
    _userId: string,
    _input: { hsCode: string; customsValueMinor: number; currency: 'ZMW' | 'USD' },
  ): Promise<EstimateOutcome> {
    return Promise.resolve({
      kind: 'refused',
      reason: 'no_verified_rule',
      notice: COMPLIANCE_ESTIMATE_NOTICE,
    });
  },

  listAgentProfiles(): Promise<AgentDirectoryEntry[]> {
    return Promise.resolve(clone(state.agentProfiles));
  },

  appointAgent(
    role: SampleRole,
    userId: string,
    input: { caseId: string; agentUserId: string; consentText: string },
  ): Promise<AppointmentResult> {
    requireRole(role, ['client_viewer']);
    const shipment = findVisibleShipment(role, userId, input.caseId);
    if (!input.consentText.trim()) throw new Error('Explicit consent is required.');
    shipment.assignedAgentId = input.agentUserId;
    shipment.updatedAt = new Date().toISOString();
    notify('appointment.created', `Sample agent appointed to ${shipment.reference}`);
    return Promise.resolve({ agencyTenantId: AGENCY_TENANT, mustReauthenticate: true });
  },

  reviewLabel(state: ImporterReviewState): string {
    return IMPORTER_REVIEW_STATE_LABELS[state];
  },
};
