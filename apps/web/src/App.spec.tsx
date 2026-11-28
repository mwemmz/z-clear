import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PROGRAM_NOT_CONFIGURED_NOTICE } from '@zclear/shared';
import { App } from './App';
import { resetSampleWorkspace } from './simulation';
import { updatedLabelFor } from './updatedLabel';

const summary = {
  id: 's1',
  reference: 'ZC-1001',
  clientName: 'Example Imports Ltd',
  clientContact: null,
  type: 'import',
  stage: 'duty_paid',
  holdReason: null,
  origin: 'Dar es Salaam',
  destination: 'Lusaka',
  consignment: { goods: 'Maize', quantity: '40 bags' },
  assignedAgentId: null,
  createdAt: '2026-11-20T08:00:00.000Z',
  updatedAt: '2026-11-21T08:00:00.000Z',
};

const detail = {
  ...summary,
  events: [
    {
      id: 'e1',
      fromStage: 'docs_received',
      toStage: 'submitted',
      note: 'Draft sent',
      source: 'api',
      actorUserId: 'u1',
      createdAt: '2026-11-20T09:00:00.000Z',
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubApi(
  overrides: {
    role?: string;
    loginStatus?: number;
    loginMessage?: string;
    assignedAgentId?: string | null;
    invoices?: Array<Record<string, unknown>>;
  } = {},
) {
  const user = {
    id: 'u1',
    tenantId: 't1',
    email: 'agent@example.com',
    role: overrides.role ?? 'agent_staff',
  };
  const shipment = { ...summary, assignedAgentId: overrides.assignedAgentId ?? null };
  let queryPosted = false;
  let checkInPosted = false;
  let paymentPosted: { amountMinor: number; method: string; paidOn: string } | null = null;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/v1/auth/login')) {
      return overrides.loginStatus
        ? jsonResponse(
            { error: { message: overrides.loginMessage ?? 'Invalid credentials' } },
            overrides.loginStatus,
          )
        : jsonResponse({ accessToken: 'demo-token', user });
    }
    if (url.endsWith('/api/v1/auth/me')) return jsonResponse(user);
    if (url.endsWith('/api/v1/shipments?limit=50')) return jsonResponse([shipment]);
    if (url.endsWith('/api/v1/shipments/s1/check-in') && init?.method === 'POST') {
      checkInPosted = true;
      const body = JSON.parse(String(init.body ?? '{}')) as { borderPost: string; note?: string };
      return jsonResponse({
        id: 'e2',
        fromStage: summary.stage,
        toStage: summary.stage,
        note: `Border check-in at ${body.borderPost}`,
        source: 'driver',
        actorUserId: 'u1',
        createdAt: '2026-11-27T10:30:00.000Z',
      });
    }
    if (url.endsWith('/api/v1/shipments/s1')) {
      return jsonResponse({
        ...detail,
        assignedAgentId: shipment.assignedAgentId,
        events: checkInPosted
          ? [
              ...detail.events,
              {
                id: 'e2',
                fromStage: summary.stage,
                toStage: summary.stage,
                note: 'Border check-in at Kasumbalesa',
                source: 'driver',
                actorUserId: 'u1',
                createdAt: '2026-11-27T10:30:00.000Z',
              },
            ]
          : detail.events,
      });
    }
    if (url.endsWith('/api/v1/reviews?limit=50')) {
      return jsonResponse([
        {
          id: 'r1',
          shipmentId: 's1',
          revision: 3,
          state: 'in_review',
          message: 'Please confirm the shipment details.',
          query: null,
          wording: null,
          wordingSource: 'fixed',
          sentAt: '2026-11-27T09:00:00.000Z',
          queriedAt: null,
          approvedAt: null,
          isStale: false,
          allowedActions: ['query', 'approve'],
          draftFindings: [],
          createdAt: '2026-11-27T09:00:00.000Z',
          updatedAt: '2026-11-27T09:00:00.000Z',
        },
        {
          id: 'r2',
          shipmentId: 's1',
          revision: 4,
          state: 'queried',
          message: 'Corrected details.',
          query: 'Is the destination still Lusaka?',
          wording: null,
          wordingSource: 'fixed',
          sentAt: '2026-11-27T10:00:00.000Z',
          queriedAt: '2026-11-27T10:10:00.000Z',
          approvedAt: null,
          isStale: false,
          allowedActions: ['send'],
          draftFindings: [],
          createdAt: '2026-11-27T10:00:00.000Z',
          updatedAt: '2026-11-27T10:10:00.000Z',
        },
      ]);
    }
    if (url.endsWith('/api/v1/notifications?limit=50')) {
      return jsonResponse([
        {
          id: 'n1',
          eventType: 'review.sent',
          entityType: 'importer_review',
          entityId: 'r1',
          channel: 'sms_mock',
          status: 'skipped',
          detail: 'SMS mock: interface only, nothing sent',
          subject: 'Review ready for shipment s1',
          createdAt: '2026-11-27T09:00:00.000Z',
        },
      ]);
    }
    if (url.endsWith('/api/v1/invoices/i1/payments') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body ?? '{}')) as {
        amountMinor: number;
        method: string;
        paidOn: string;
      };
      paymentPosted = body;
      return jsonResponse({
        id: 'i1',
        shipmentId: 's1',
        number: 'INV-0001',
        status: 'paid',
        currency: 'ZMW',
        totalMinor: 60_000,
        amountPaidMinor: 60_000,
        balanceMinor: 0,
        notes: 'Synthetic demo: agency clearance service fee only.',
        vatVerificationStatus: 'NEEDS_VERIFICATION',
        issuedAt: '2026-11-27T08:00:00.000Z',
        lines: [],
        payments: [],
      });
    }
    if (url.endsWith('/api/v1/invoices?limit=50')) {
      return jsonResponse([
        {
          id: 'i1',
          shipmentId: 's1',
          number: 'INV-0001',
          status: paymentPosted ? 'paid' : 'issued',
          currency: 'ZMW',
          totalMinor: 60_000,
          amountPaidMinor: paymentPosted ? 60_000 : 0,
          balanceMinor: paymentPosted ? 0 : 60_000,
          notes:
            'Synthetic demo: agency clearance service fee only. Not a ZRA assessment; no duty or VAT included.',
          vatVerificationStatus: 'NEEDS_VERIFICATION',
          issuedAt: '2026-11-27T08:00:00.000Z',
          lines: [
            {
              chargeType: 'agency_fee',
              description: 'Agency clearance service fee (synthetic)',
              lineAmountMinor: 60_000,
            },
          ],
          payments: [],
        },
        ...(overrides.invoices ?? []),
      ]);
    }
    if (url.endsWith('/api/v1/guidance')) {
      return jsonResponse([
        {
          id: 'g1',
          stepKey: 'tpin_registration',
          title: 'TPIN registration',
          detail: 'Agency guidance only; confirm with ZRA.',
          sortOrder: 1,
          isActive: true,
          sourceUrl: null,
          effectiveDate: null,
          verificationStatus: 'NEEDS_VERIFICATION',
          isVerified: false,
        },
      ]);
    }
    if (url.endsWith('/api/v1/agent-profiles')) {
      return jsonResponse([
        {
          id: 'a1',
          userId: 'agent-1',
          agencyName: 'Copperbelt Clearing',
          location: 'Ndola',
          serviceArea: 'Copperbelt',
          languages: 'English, Bemba',
          licenceStatus: 'SIMULATED',
          licenceNotice: 'Simulated, pending ZRA API',
        },
      ]);
    }
    if (url.endsWith('/api/v1/appointments')) {
      return jsonResponse({ agencyTenantId: 't2', mustReauthenticate: true }, 201);
    }
    if (url.endsWith('/api/v1/cases/s1/valuation')) {
      return jsonResponse({
        caseId: 's1',
        recorded: {
          label: 'Value you recorded',
          description: 'Packaged maize flour',
          amountMinor: 32000000,
          currency: 'ZMW',
          formatted: 'K 320,000.00',
        },
        notice:
          'This is the value recorded on your case, not a customs assessment. Z Clear does not decide customs value, assess duty or tax, or send anything to ZRA. Customs value is decided in ASYCUDA World.',
        review: {
          id: 'r1',
          revision: 1,
          state: queryPosted ? 'queried' : 'in_review',
          query: queryPosted ? 'The value does not match my records.' : null,
          allowedActions: queryPosted ? [] : ['query'],
        },
      });
    }
    if (url.endsWith('/api/v1/reviews/r1/query') && init?.method === 'POST') {
      queryPosted = true;
      return jsonResponse({
        id: 'r1',
        revision: 1,
        state: 'queried',
        query: 'The value does not match my records.',
      });
    }
    if (url.endsWith('/api/v1/compliance/assistant/s1')) {
      return jsonResponse({
        caseId: 's1',
        prompts: [
          {
            id: 'agency:proof_of_purchase',
            text: 'Confirm with your agency: Proof of purchase.',
            origin: 'agency_requirement',
            verificationStatus: 'NEEDS_VERIFICATION',
            sourceUrl: 'https://example.com/agency-note',
            effectiveDate: '2026-01-01',
          },
        ],
        wordingSource: 'fixed',
        notice:
          'These are questions to confirm with your agency, not legal advice or a ZRA requirement. Z Clear does not decide what customs requires or assess any amount; declarations and decisions happen in ASYCUDA World.',
      });
    }
    if (url.endsWith('/api/v1/compliance/estimate') && init?.method === 'POST') {
      return jsonResponse({
        kind: 'refused',
        reason: 'no_verified_rule',
        notice:
          'Illustrative estimate only. Z Clear does not assess duty, VAT or fees, decide customs value or file declarations. Customs amounts are decided in ASYCUDA World. Do not pay or file on this figure.',
      });
    }
    if (url.endsWith('/api/v1/cases/s1/status')) {
      return jsonResponse({
        caseId: 's1',
        answers: [
          {
            question: 'Where is my case?',
            answer: 'Duty paid. This is the latest stage your agency recorded.',
          },
          {
            question: 'What do I owe?',
            answer: 'No unpaid invoice balance is recorded.',
          },
        ],
        notice:
          'Stages are your agency’s manual record. Customs steps happen in ASYCUDA World; Z Clear does not assess duty or decide release.',
      });
    }
    if (url.endsWith('/api/v1/cases/s1/checklist')) {
      return jsonResponse({
        caseKind: 'goods',
        rules: [
          {
            docType: 'proof_of_purchase',
            label: 'Proof of purchase',
            isMandatory: true,
            sortOrder: 1,
            caseKind: null,
            sourceUrl: null,
            effectiveDate: null,
            verificationStatus: 'NEEDS_VERIFICATION',
            satisfied: false,
          },
        ],
        missingMandatory: ['proof_of_purchase'],
        hasUnverifiedRules: true,
        notice: 'This checklist is agency guidance.',
      });
    }
    const emptyProgram = {
      version: 0,
      verificationStatus: 'NEEDS_VERIFICATION',
      configuredAt: null,
      notice: PROGRAM_NOT_CONFIGURED_NOTICE,
    };
    if (url.endsWith('/api/v1/points/me')) {
      return jsonResponse({ program: emptyProgram, balance: null, ledger: [] });
    }
    if (url.endsWith('/api/v1/points/ledger?limit=50')) return jsonResponse([]);
    if (url.endsWith('/api/v1/referrals/me')) {
      return jsonResponse({ program: emptyProgram, records: [] });
    }
    return jsonResponse({ error: { message: 'Not found' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function signIn(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'agent@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetSampleWorkspace();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('shows the sign-in form when no token is present', () => {
    stubApi();
    const { container } = render(<App />);
    expect(screen.getByRole('heading', { name: 'Z Clear' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByTestId('role-badge')).not.toBeInTheDocument();
    // Both panels are layout hooks for the equal-size, mobile-first login cards.
    expect(container.querySelector('.shell--login')).toBeInTheDocument();
    expect(container.querySelector('.login-panel__form')).toBeInTheDocument();
    expect(container.querySelector('.login-panel__guide')).toBeInTheDocument();
  });

  it('shows a four-role sign-in guide without embedding credentials', () => {
    stubApi();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Four demo roles' })).toBeInTheDocument();
    expect(screen.getAllByText('Clearing agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Importer / client').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Platform admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Driver').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('@');
  });

  it('opens the sample workspace when a login role card is tapped', async () => {
    const fetchMock = stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('guide-login-agent_staff'));

    expect(await screen.findByTestId('role-badge')).toHaveTextContent('Clearing agent');
    expect(await screen.findByTestId('sample-toolbar')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the signed-in role and the case file from the shipment endpoint', async () => {
    stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('role-badge')).toHaveTextContent('Clearing agent');
    expect(await screen.findByTestId('case-reference')).toHaveTextContent('ZC-1001');
    expect(screen.getByTestId('case-client')).toHaveTextContent('Example Imports Ltd');
    expect(screen.getByTestId('case-route')).toHaveTextContent('Dar es Salaam → Lusaka');
    expect(screen.getByTestId('case-goods')).toHaveTextContent('goods: Maize');
    expect(screen.getByTestId('case-stage')).toHaveTextContent('Duty paid');
  });

  it('shows real outbox outcomes and states that the SMS mock sends nothing', async () => {
    const fetchMock = stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByText('Notification status')).toBeInTheDocument();
    expect(await screen.findByTestId('notification-status-value')).toHaveTextContent('skipped');
    expect(screen.getByText('Review sent')).toBeInTheDocument();
    expect(screen.getByTestId('notification-notice')).toHaveTextContent(/sends nothing/);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/notifications?limit=50'),
      expect.any(Object),
    );
  });

  it('lets agency staff record an off-platform payment against the issued invoice', async () => {
    const fetchMock = stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('invoice-row')).toHaveTextContent('INV-0001');
    expect(screen.getByTestId('payment-notice')).toHaveTextContent(/not a ZRA assessment/);
    fireEvent.change(screen.getByLabelText('Payment amount in ZMW'), {
      target: { value: '600.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));

    expect(await screen.findByTestId('payment-confirmation')).toHaveTextContent(
      /No money was moved by this app/,
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/invoices/i1/payments') && init?.method === 'POST',
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      amountMinor: 60_000,
      method: 'mobile_money',
    });
  });

  it('keeps invoices from another case out of the selected case file', async () => {
    stubApi({
      invoices: [
        {
          id: 'i2',
          shipmentId: 's2',
          number: 'INV-9999',
          status: 'issued',
          currency: 'ZMW',
          totalMinor: 10_000,
          amountPaidMinor: 0,
          balanceMinor: 10_000,
          notes: 'Synthetic invoice for a different case.',
          vatVerificationStatus: 'NEEDS_VERIFICATION',
          issuedAt: '2026-11-27T08:00:00.000Z',
          lines: [],
          payments: [],
        },
      ],
    });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toHaveTextContent('ZC-1001');
    expect(await screen.findByText('INV-0001')).toBeInTheDocument();
    expect(screen.queryByText('INV-9999')).not.toBeInTheDocument();
  });

  it('shows invoices read-only to an importer', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('invoice-row')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument();
    expect(screen.getByText(/Only agency staff can record a payment/)).toBeInTheDocument();
  });

  it('does not show invoices to the driver role', async () => {
    stubApi({ role: 'driver' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByText('Invoices & payments')).not.toBeInTheDocument();
  });

  it('shows agency-configured guidance with its verification status', async () => {
    const fetchMock = stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('guidance-row')).toHaveTextContent('TPIN registration');
    expect(screen.getByTestId('guidance-verification')).toHaveTextContent('Needs verification');
    expect(screen.getByTestId('guidance-notice')).toHaveTextContent(/guidance only/);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/guidance'),
      expect.any(Object),
    );
  });

  it('does not show registry guidance to the driver role', async () => {
    stubApi({ role: 'driver' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByText('Registry guidance')).not.toBeInTheDocument();
  });

  it('does not show delivery outcomes to the driver role', async () => {
    stubApi({ role: 'driver' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByText('Notification status')).not.toBeInTheDocument();
  });

  it('shows agency staff a real review inbox backed by GET /reviews', async () => {
    const fetchMock = stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByText('Review inbox')).toBeInTheDocument();
    expect(await screen.findByText('Waiting for importer')).toBeInTheDocument();
    expect(screen.getByText('Answer importer query')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/reviews?limit=50'),
      expect.any(Object),
    );
  });

  it('does not show the staff review inbox to an importer', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByText('Review inbox')).not.toBeInTheDocument();
  });

  it('lets the assigned driver record a manual check-in without changing the stage', async () => {
    const fetchMock = stubApi({ role: 'driver' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('role-badge')).toHaveTextContent('Driver');
    expect(await screen.findByText('Driver check-in')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Border post'), {
      target: { value: 'Kasumbalesa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record check-in' }));

    expect(await screen.findByTestId('checkin-status')).toHaveTextContent('stage is unchanged');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/shipments/s1/check-in'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows the read-only stage timeline and no audit activity list', async () => {
    stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByText('Draft sent')).toBeInTheDocument();
    expect(screen.getByText('Submitted to customs')).toBeInTheDocument();
    expect(screen.getByText(/Read-only timeline/)).toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
  });

  it('makes an importer role obvious in the header', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('role-badge')).toHaveTextContent('Importer / client');
  });

  it('shows the importer a provenance-labelled checklist, not official claims', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('checklist-unverified-banner')).toHaveTextContent(
      /not an official ZRA requirement/,
    );
    expect(screen.getByTestId('checklist-proof_of_purchase')).toHaveTextContent(
      'Proof of purchase',
    );
    expect(screen.getByTestId('checklist-proof_of_purchase')).toHaveTextContent('Unverified');
    expect(screen.getByTestId('checklist-missing')).toHaveTextContent('Still needed: 1');
  });

  it('shows the importer plain-language status with the ASYCUDA boundary notice', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    const answers = await screen.findByTestId('case-status-answers');
    expect(answers).toHaveTextContent('Where is my case?');
    expect(answers).toHaveTextContent('Duty paid');
    expect(answers).toHaveTextContent('No unpaid invoice balance is recorded');
    expect(screen.getByTestId('case-status-notice')).toHaveTextContent(
      /does not assess duty or decide release/,
    );
  });

  it('lets an importer query the agent when the recorded value is disputed', async () => {
    const fetchMock = stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('valuation-amount')).toHaveTextContent(/320/);
    expect(screen.getByTestId('valuation-notice')).toHaveTextContent(/not a customs assessment/);
    fireEvent.change(screen.getByLabelText(/If this is not what you meant/), {
      target: { value: 'The value does not match my records.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send question to my agent' }));

    expect(await screen.findByTestId('valuation-confirmation')).toHaveTextContent(/recorded/);
    expect(await screen.findByTestId('recorded-question')).toHaveTextContent(
      'The value does not match my records.',
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/v1/reviews/r1/query') && init?.method === 'POST',
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      message: 'The value does not match my records.',
    });
  });

  it('shows labelled compliance prompts and refuses to guess a figure', async () => {
    const fetchMock = stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('compliance-prompts')).toHaveTextContent(
      'Confirm with your agency: Proof of purchase.',
    );
    expect(screen.getByTestId('compliance-notice')).toHaveTextContent(/not legal advice/);
    expect(screen.getByText(/NEEDS_VERIFICATION/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('HS code'), { target: { value: '1102200000' } });
    fireEvent.change(screen.getByLabelText('Value in ZMW'), { target: { value: '320000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check for a verified figure' }));

    expect(await screen.findByTestId('estimate-refusal')).toHaveTextContent(
      /no verified tariff rule/i,
    );
    expect(screen.queryByTestId('estimate-result')).not.toBeInTheDocument();
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/api/v1/compliance/estimate') && init?.method === 'POST',
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      hsCode: '1102200000',
      customsValueMinor: 32000000,
      currency: 'ZMW',
    });
  });

  it('does not show the importer checklist to agent staff', async () => {
    stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByText('Your document checklist')).not.toBeInTheDocument();
    expect(screen.queryByTestId('case-status-answers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recorded-valuation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compliance-prompts')).not.toBeInTheDocument();
  });

  it('lets an importer open a typed case before any agent is appointed', async () => {
    const importer = {
      id: 'u9',
      tenantId: 't9',
      email: 'importer@example.com',
      role: 'client_viewer',
    };
    const created = {
      ...summary,
      id: 's9',
      reference: 'CASE-ABC123',
      clientName: 'New Imports Ltd',
      consignment: { caseKind: 'vehicle', vehicle: { make: 'Toyota' } },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/login')) {
        return jsonResponse({ accessToken: 'importer-token', user: importer });
      }
      if (url.endsWith('/api/v1/auth/me')) return jsonResponse(importer);
      if (url.endsWith('/api/v1/shipments?limit=50')) return jsonResponse([]);
      if (url.endsWith('/api/v1/shipments/s9')) {
        return jsonResponse({ ...created, events: [] });
      }
      if (url.endsWith('/api/v1/cases') && init?.method === 'POST') {
        return jsonResponse(created, 201);
      }
      return jsonResponse({ error: { message: 'Not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await signIn();
    fireEvent.click(await screen.findByRole('button', { name: 'Open a new case' }));

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'New Imports Ltd' } });
    fireEvent.change(screen.getByLabelText('Phone or email'), {
      target: { value: '+260970000009' },
    });
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Toyota' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Hilux' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2022' } });
    fireEvent.change(screen.getByLabelText('VIN or chassis'), {
      target: { value: 'AHTFR22C000000001' },
    });
    fireEvent.change(screen.getByLabelText('Engine'), { target: { value: '2GD-FTV' } });
    fireEvent.change(screen.getByLabelText('Purchase price (ZMW)'), {
      target: { value: '18500000' },
    });
    fireEvent.change(screen.getByLabelText('Origin'), { target: { value: 'Japan' } });
    fireEvent.change(screen.getByLabelText('Port of entry'), { target: { value: 'Ndola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create case' }));

    expect(await screen.findByTestId('case-reference')).toHaveTextContent('CASE-ABC123');
    const call = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/v1/cases') && init?.method === 'POST',
    );
    expect(call).toBeDefined();
    const body = JSON.parse(String(call?.[1]?.body)) as {
      clientName: string;
      consignment: { caseKind: string; vehicle: { purchasePriceMinor: number } };
    };
    expect(body.clientName).toBe('New Imports Ltd');
    expect(body.consignment.caseKind).toBe('vehicle');
    expect(body.consignment.vehicle.purchasePriceMinor).toBe(1850000000);
  });

  it('shows the API error message when sign-in fails', async () => {
    stubApi({ loginStatus: 401, loginMessage: 'Invalid email or password' });
    render(<App />);
    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByTestId('case-reference')).not.toBeInTheDocument();
  });

  it('shows the importer a labelled agent directory with simulated licence status', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('agent-directory')).toBeInTheDocument();
    expect(screen.getByTestId('agent-directory-notice')).toHaveTextContent(
      /simulated, pending ZRA API/,
    );
    expect(await screen.findByTestId('agent-a1')).toHaveTextContent('Copperbelt Clearing');
    expect(screen.getByTestId('agent-licence-a1')).toHaveTextContent('Simulated, pending ZRA API');
  });

  it('shows one real agent directory in the Agents tab and no mock controls', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('agent-directory')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('nav-toggle'));
    fireEvent.click(
      within(await screen.findByTestId('nav-drawer')).getByRole('button', { name: 'Agents' }),
    );
    expect(await screen.findByTestId('agent-a1')).toHaveTextContent('Copperbelt Clearing');

    expect(screen.getAllByTestId('agent-directory')).toHaveLength(1);
    expect(screen.queryByText(/Sample, not ZRA figures/)).not.toBeInTheDocument();
  });

  it('requires explicit consent, appoints the chosen agent and asks the importer to sign in again', async () => {
    const fetchMock = stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    const appointButton = await screen.findByRole(
      'button',
      { name: 'Appoint this agent' },
      { timeout: 5000 },
    );
    expect(appointButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I understand my case and importer account/));
    expect(appointButton).toBeEnabled();
    fireEvent.click(appointButton);

    expect(await screen.findByTestId('appointment-notice')).toHaveTextContent(/Sign in again/);
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/v1/appointments') && init?.method === 'POST',
    );
    expect(call).toBeDefined();
    const body = JSON.parse(String(call?.[1]?.body)) as {
      caseId: string;
      agentUserId: string;
      consentText: string;
    };
    expect(body).toMatchObject({ caseId: 's1', agentUserId: 'agent-1' });
    expect(body.consentText.length).toBeGreaterThan(9);
  });

  it('hides the agent directory from staff and from cases that already have an agent', async () => {
    stubApi();
    render(<App />);
    await signIn();
    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-directory')).not.toBeInTheDocument();
  });

  it('does not offer appointment again once an agent is assigned', async () => {
    stubApi({ role: 'client_viewer', assignedAgentId: 'agent-1' });
    render(<App />);
    await signIn();
    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-directory')).not.toBeInTheDocument();
  });

  it('opens a fully usable sample workspace without credentials or network calls', async () => {
    const fetchMock = stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('sample-login-agent_staff'));

    expect(await screen.findByTestId('sample-toolbar')).toHaveTextContent('Sample data');
    expect(await screen.findByTestId('role-badge')).toHaveTextContent('Clearing agent');
    expect(await screen.findByTestId('case-reference')).toHaveTextContent('ZCLR-2041');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records a one-tap manual stage change in the sample workspace', async () => {
    stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('sample-login-agent_staff'));

    expect(await screen.findByTestId('case-stage')).toHaveTextContent('In transit');
    fireEvent.click(screen.getByRole('button', { name: 'Mark Delivered' }));

    expect(await screen.findByTestId('case-stage')).toHaveTextContent('Delivered');
    expect(screen.getAllByText('Delivered').length).toBeGreaterThan(1);
    expect(screen.getByText(/Manual record: Delivered/)).toBeInTheDocument();
  });

  it('jumps from the sample case sheet to the real case sections', async () => {
    stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('sample-login-client_viewer'));

    fireEvent.click(await screen.findByRole('button', { name: 'Open case' }));
    const sheet = await screen.findByRole('dialog', { name: /Case details/ });
    fireEvent.click(within(sheet).getByRole('tab', { name: 'Payments' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Go to payments' }));

    expect(screen.queryByRole('dialog', { name: /Case details/ })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.getElementById('case-payments'));
  });

  it('lets an importer approve a live review draft in the sample workspace', async () => {
    stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('sample-login-client_viewer'));

    expect(await screen.findByRole('button', { name: 'Approve this draft' })).toBeInTheDocument();
    expect(screen.getByTestId('review-screen')).toHaveTextContent('Review draft');
    fireEvent.click(screen.getByRole('button', { name: 'Approve this draft' }));

    expect(await screen.findByText('Review complete')).toBeInTheDocument();
    expect(screen.getByText(/agency still handles the manual handoff/)).toBeInTheDocument();
  });

  it('carries an importer query into the staff inbox when the sample role switches', async () => {
    stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('sample-login-client_viewer'));

    expect(await screen.findByLabelText('Question for your agent')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Question for your agent'), {
      target: { value: 'Please check the sample value.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query this draft' }));

    expect(await screen.findByText(/Question recorded on revision/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Switch sample role'), {
      target: { value: 'agent_staff' },
    });

    expect(await screen.findByText('Review inbox')).toBeInTheDocument();
    expect(await screen.findByText('Query: Please check the sample value.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Send revision' })).toBeInTheDocument();
  });

  it('restores the seeded sample case when sample data is reset', async () => {
    stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('sample-login-agent_staff'));

    expect(await screen.findByTestId('case-stage')).toHaveTextContent('In transit');
    fireEvent.click(screen.getByRole('button', { name: 'Mark Delivered' }));
    expect(await screen.findByTestId('case-stage')).toHaveTextContent('Delivered');

    fireEvent.click(screen.getByRole('button', { name: 'Reset sample data' }));

    expect(await screen.findByTestId('case-stage')).toHaveTextContent('In transit');
    expect(screen.queryByText(/Manual record: Delivered/)).not.toBeInTheDocument();
  });

  it('clears an expired session and returns to the sign-in choice', async () => {
    sessionStorage.setItem('zclear_demo_token', 'expired-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/api/v1/auth/me')) {
          return jsonResponse({ error: { message: 'Session expired' } }, 401);
        }
        return jsonResponse([]);
      }),
    );

    render(<App />);

    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Session expired/);
    expect(sessionStorage.getItem('zclear_demo_token')).toBeNull();
  });

  it('opens the phone drawer from the hamburger and navigates from it', async () => {
    stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('app-rail')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('nav-toggle'));

    const drawer = await screen.findByTestId('nav-drawer');
    expect(screen.getByTestId('nav-toggle')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Agents' }));

    expect(await screen.findByTestId('agent-directory')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-drawer')).not.toBeInTheDocument();
  });

  it('uses the shared rail to open profile for staff', async () => {
    stubApi();
    render(<App />);
    await signIn();

    const rail = await screen.findByTestId('app-rail');
    fireEvent.click(within(rail).getByRole('button', { name: 'Profile' }));

    expect(await screen.findByTestId('profile-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-workspace')).not.toBeInTheDocument();
  });

  it('opens the points and referrals side panel with unconfigured copy', async () => {
    const fetchMock = stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();
    expect(await screen.findByTestId('app-rail')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('loyalty-open'));
    const panel = await screen.findByTestId('loyalty-panel');

    expect(await within(panel).findAllByText(PROGRAM_NOT_CONFIGURED_NOTICE)).toHaveLength(2);
    expect(within(panel).getByTestId('points-balance')).toHaveTextContent('Not available');
    expect(within(panel).getByTestId('referrals-notice')).toHaveTextContent(
      PROGRAM_NOT_CONFIGURED_NOTICE,
    );
    const loyaltyUrls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/points/') || url.includes('/referrals/'));
    expect(loyaltyUrls).toEqual([
      expect.stringContaining('/api/v1/points/me'),
      expect.stringContaining('/api/v1/referrals/me'),
    ]);

    fireEvent.click(within(panel).getByRole('button', { name: 'Close programme panel' }));
    expect(screen.queryByTestId('loyalty-panel')).not.toBeInTheDocument();
  });

  it('shows a denied loyalty panel to a sample driver without a request', async () => {
    const fetchMock = stubApi();
    render(<App />);
    fireEvent.click(screen.getByTestId('guide-login-driver'));
    expect(await screen.findByTestId('role-badge')).toHaveTextContent('Driver');

    fireEvent.click(screen.getByTestId('loyalty-open'));
    const panel = await screen.findByTestId('loyalty-panel');
    expect(within(panel).getByText('Not available for this role')).toBeInTheDocument();
    expect(within(panel).getByTestId('loyalty-sample-label')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never presents clock skew as a future last update', () => {
    const ahead = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(updatedLabelFor(ahead)).toBe('just now');
    expect(updatedLabelFor('not-a-date')).toBeUndefined();
    expect(updatedLabelFor(undefined)).toBeUndefined();
  });
});
