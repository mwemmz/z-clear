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

function stubApi(overrides: { role?: string; loginStatus?: number; loginMessage?: string } = {}) {
  const user = {
    id: 'u1',
    tenantId: 't1',
    email: 'agent@example.com',
    role: overrides.role ?? 'agent_staff',
  };
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
    if (url.endsWith('/api/v1/shipments?limit=50')) return jsonResponse([summary]);
    if (url.endsWith('/api/v1/shipments/s1')) return jsonResponse(detail);
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

  it('does not show the importer checklist to agent staff', async () => {
    stubApi();
    render(<App />);
    await signIn();

    expect(await screen.findByTestId('case-reference')).toBeInTheDocument();
    expect(screen.queryByText('Your document checklist')).not.toBeInTheDocument();
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
});
