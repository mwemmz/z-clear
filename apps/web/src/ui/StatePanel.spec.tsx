import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatePanel } from './StatePanel';
import { StatusPill } from './StatusPill';

describe('state and status primitives', () => {
  it('renders plain-language states with an alert for errors', () => {
    const { container } = render(<StatePanel variant="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this');
    expect(container.querySelector('.state-panel--error')).toBeInTheDocument();
  });

  it('renders denied and stale-draft states', () => {
    render(
      <>
        <StatePanel variant="denied" />
        <StatePanel variant="stale" />
      </>,
    );
    expect(screen.getByText('You cannot open this case')).toBeInTheDocument();
    expect(screen.getByText('A newer draft is available')).toBeInTheDocument();
  });

  it('keeps status pills icon plus text', () => {
    const { container } = render(<StatusPill tone="success">Ready for ASYCUDA</StatusPill>);
    expect(screen.getByText('Ready for ASYCUDA')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
