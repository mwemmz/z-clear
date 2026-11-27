import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

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
  } = {},
) {
  const user = {
    id: 'u1',
    tenantId: 't1',
    email: 'agent@example.com',
    role: overrides.role ?? 'agent_staff',
  };
  const shipment = { ...summary, assignedAgentId: overrides.assignedAgentId ?? null };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
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
    if (url.endsWith('/api/v1/shipments/s1')) {
      return jsonResponse({ ...detail, assignedAgentId: shipment.assignedAgentId });
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('shows the sign-in form when no token is present', () => {
    stubApi();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Z Clear' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByTestId('role-badge')).not.toBeInTheDocument();
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

  it('does not show the importer checklist to agent staff', async () => {
    stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByText('Your document checklist')).not.toBeInTheDocument();
    expect(screen.queryByTestId('case-status-answers')).not.toBeInTheDocument();
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

  it('requires explicit consent, appoints the chosen agent and asks the importer to sign in again', async () => {
    const fetchMock = stubApi({ role: 'client_viewer' });
    render(<App />);
    await signIn();

    const appointButton = await screen.findByRole('button', { name: 'Appoint this agent' });
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
});
