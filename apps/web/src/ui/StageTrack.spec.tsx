import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageTrack } from './StageTrack';

describe('StageTrack', () => {
  afterEach(() => vi.useRealTimers());

  it('marks the current stage and names it for assistive technology', () => {
    const { container } = render(<StageTrack stage="submitted" updatedLabel="2h ago" />);
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent(
      'Submitted to customs',
    );
    expect(container.querySelector('.stage-track')).toHaveAttribute(
      'aria-label',
      'Current stage: Submitted to customs',
    );
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();
  });

  it('animates only after a stage change', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<StageTrack stage="docs_received" />);
    expect(container.querySelector('.stage-track')).not.toHaveAttribute('data-animate');
    rerender(<StageTrack stage="submitted" />);
    expect(container.querySelector('.stage-track')).toHaveAttribute('data-animate');
    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelector('.stage-track')).not.toHaveAttribute('data-animate');
  });

  it('keeps held cases explicit without pretending a customs decision happened', () => {
    const { container } = render(<StageTrack stage="on_hold" />);
    expect(container.querySelector('.stage-track')).toHaveAttribute('data-held');
    expect(container.querySelector('.stage-track__caption')).toHaveTextContent('On hold');
    expect(container.querySelector('[aria-current="step"]')).not.toBeInTheDocument();
  });
});
