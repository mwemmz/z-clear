import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mockups } from './index';

describe('mockups', () => {
  it('renders all six labelled mock screens with the MOCK badge', () => {
    render(<Mockups />);
    const labels = [
      'Zamtel SIM sign-up & PIN',
      'Registry guidance',
      'SMS status updates',
      'Zamtel Money fee payment',
      'Agent reviews',
      'Cross check-in',
    ];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('MOCK')).toHaveLength(6);
    // Sample-data note appears on each screen.
    expect(screen.getAllByText(/Sample data only/)).toHaveLength(6);
  });

  it('never presents customs figures as payable in the demo payment screen', () => {
    render(<Mockups />);
    expect(screen.getByText(/Assessed in ASYCUDA World/)).toBeInTheDocument();
  });
});
