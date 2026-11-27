import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mockups } from './index';

describe('mockups', () => {
  it('renders the two remaining labelled mock screens with the MOCK badge', () => {
    render(<Mockups />);
    const labels = ['Zamtel SIM sign-up & PIN', 'Zamtel Money fee payment'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('MOCK')).toHaveLength(2);
    expect(screen.getAllByText(/Sample data only/)).toHaveLength(2);
    for (const removed of [
      'Agent reviews',
      'Cross check-in',
      'SMS status updates',
      'Registry guidance',
    ]) {
      expect(screen.queryByText(removed)).not.toBeInTheDocument();
    }
  });

  it('never presents customs figures as payable in the demo payment screen', () => {
    render(<Mockups />);
    expect(screen.getByText(/Assessed in ASYCUDA World/)).toBeInTheDocument();
  });
});
