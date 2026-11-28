import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignGallery } from '../design/DesignGallery';
import {
  AgentDirectoryMock,
  AgentWorkspace,
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
  recentCases: [{ reference: 'ZCLR-2038', stage: 'delivered' as const }],
  onOpenCase: noop,
  onNewCase: noop,
  onAgents: noop,
  onProfile: noop,
};

describe('redesigned role screens', () => {
  afterEach(() => {
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
        onClearPoints={noop}
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
          onClearPoints={noop}
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
