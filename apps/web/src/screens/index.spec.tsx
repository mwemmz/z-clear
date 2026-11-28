import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignGallery } from '../design/DesignGallery';
import {
  AgentDirectoryMock,
  AgentWorkspace,
  CaseSheet,
  ImporterHome,
  ProfilePanel,
  ReviewScreen,
} from './index';

const noop = () => undefined;

const importerProps = {
  reference: 'ZCLR-2041',
  clientName: 'Sample Importer',
  stage: 'submitted' as const,
  actionText: 'Check the review draft before it is filed in ASYCUDA.',
  recentCases: [{ id: 's2', reference: 'ZCLR-2038', stage: 'delivered' as const }],
  onOpenCase: noop,
  onSelectCase: noop,
  onNewCase: noop,
  onAgents: noop,
  onProfile: noop,
};

describe('redesigned role screens', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('gives the importer one current case and one primary action', () => {
    const onOpenCase = vi.fn();
    render(<ImporterHome {...importerProps} onOpenCase={onOpenCase} />);

    expect(screen.getByTestId('importer-home')).toBeInTheDocument();
    expect(screen.getByText('ZCLR-2041')).toBeInTheDocument();
    expect(screen.getByText('ZCLR-2038')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open case' }));
    expect(onOpenCase).toHaveBeenCalledOnce();
  });

  it('lets an agent select a case from the compact queue', () => {
    const onSelect = vi.fn();
    render(
      <AgentWorkspace
        cases={[{ id: 's1', reference: 'ZCLR-2041', stage: 'submitted' }]}
        activeId={null}
        onSelect={onSelect}
      >
        <p>Case detail</p>
      </AgentWorkspace>,
    );

    fireEvent.click(screen.getByRole('button', { name: /ZCLR-2041/ }));
    expect(onSelect).toHaveBeenCalledWith('s1');
    expect(screen.getByText('Case detail')).toBeInTheDocument();
  });

  it('switches case-sheet sections and keeps the sheet mounted until the exit finishes', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <CaseSheet
        open
        onClose={onClose}
        reference="ZCLR-2041"
        route="Ndola → Kasumbalesa"
        stage="submitted"
        documentsReady={0}
        documentsTotal={0}
      >
        <p>Case facts</p>
      </CaseSheet>,
    );

    expect(screen.getByText('Case facts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(screen.queryByText('Case facts')).not.toBeInTheDocument();
    expect(screen.getByText(/Document readiness is not included/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close case details' }));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(150));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('names the case sheet, omits unknown counts, and supports first/last tab keys', () => {
    render(
      <CaseSheet
        open
        onClose={noop}
        reference="ZCLR-2041"
        route="Ndola → Kasumbalesa"
        stage="submitted"
        documentsReady={0}
        documentsTotal={0}
      >
        <p>Case facts</p>
      </CaseSheet>,
    );

    expect(screen.getByRole('dialog', { name: /Case details.*ZCLR-2041/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Document count not available' })).toBeInTheDocument();
    expect(screen.queryByLabelText('0 of 0 documents ready')).not.toBeInTheDocument();

    const payments = screen.getByRole('tab', { name: 'Payments' });
    fireEvent.click(payments);
    fireEvent.keyDown(payments, { key: 'Home' });
    const info = screen.getByRole('tab', { name: 'Info' });
    expect(info).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(info, { key: 'End' });
    expect(payments).toHaveAttribute('aria-selected', 'true');
    expect(payments).toHaveAttribute('aria-controls', 'case-panel-current');
  });

  it('keeps the agent directory visibly mock and filterable', () => {
    render(<AgentDirectoryMock />);
    expect(screen.getByText(/Sample, not ZRA figures/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nearby' }));
    expect(screen.getByText('Chanda Clearing')).toBeInTheDocument();
    expect(screen.queryByText('Lusaka Desk')).not.toBeInTheDocument();
  });

  it('blocks approval and shows one stale-draft notice when the draft is stale', () => {
    render(
      <ReviewScreen
        revision={3}
        field="Declared value"
        draftValue="K 12,400"
        sourceValue="K 12,000"
        message="Check before you approve."
        stale
        onQuery={noop}
        onApprove={noop}
      />,
    );

    expect(screen.getByText('A newer draft is available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve this draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Query this draft' })).toBeDisabled();
  });

  it('renders denied access on each role screen instead of leaking case data', () => {
    render(
      <>
        <ImporterHome {...importerProps} state="denied" />
        <AgentWorkspace cases={[]} activeId={null} onSelect={noop} state="denied">
          <p>Private detail</p>
        </AgentWorkspace>
        <AgentDirectoryMock state="denied" />
        <ProfilePanel
          email="private@example.test"
          roleLabel="Importer"
          onSignOut={noop}
          state="denied"
        />
        <ReviewScreen
          revision={3}
          field="Declared value"
          draftValue="K 12,400"
          sourceValue="K 12,000"
          message="Check before you approve."
          state="denied"
          onQuery={noop}
          onApprove={noop}
        />
      </>,
    );

    expect(screen.getAllByText('You cannot open this case')).toHaveLength(5);
    expect(screen.queryByText('ZCLR-2041')).not.toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
  });

  it('exposes a single-screen dev preview for screenshot review', () => {
    render(<DesignGallery screen="importer" />);
    expect(screen.getByTestId('importer-home')).toBeInTheDocument();
    expect(screen.queryByText('Component gallery')).not.toBeInTheDocument();
  });
});
