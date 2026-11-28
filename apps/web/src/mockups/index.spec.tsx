import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mockups } from './index';

describe('mockups', () => {
  it('renders every mock screen with a MOCK badge and sample-data note', () => {
    render(<Mockups />);
    const labels = [
      'USSD-lite menu',
      'SMS messages',
      'Cross check-in',
      'ASYCUDA outage notice',
      'Cost check',
      'Agent reviews',
      'Zamtel SIM sign-up & PIN',
      'Zamtel Money fee payment',
    ];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('MOCK')).toHaveLength(labels.length);
    expect(screen.getAllByText(/Sample data only/)).toHaveLength(labels.length);
  });

  it('never presents customs figures as payable', () => {
    render(<Mockups />);
    expect(screen.getByText(/Assessed in ASYCUDA World/)).toBeInTheDocument();
    expect(screen.getAllByText(/sample, not ZRA figures/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/K 450\.00/)).toBeInTheDocument();
    expect(screen.getByText(/No verified rule/)).toBeInTheDocument();
  });
});
