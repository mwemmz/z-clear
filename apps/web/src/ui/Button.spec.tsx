import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { X } from '@phosphor-icons/react';
import { Button } from './Button';

describe('Button', () => {
  afterEach(() => vi.useRealTimers());

  it('renders each variant with a semantic class', () => {
    const { container } = render(
      <>
        <Button variant="primary">Approve</Button>
        <Button variant="secondary">Save later</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="nav-new">New case</Button>
        <Button variant="icon" iconOnly aria-label="Close">
          <X size={20} aria-hidden="true" />
        </Button>
      </>,
    );
    for (const variant of ['primary', 'secondary', 'destructive', 'ghost', 'nav-new', 'icon']) {
      expect(container.querySelector(`.zc-button--${variant}`)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('keeps its label in place while loading', () => {
    render(<Button loading>Send draft</Button>);
    const button = screen.getByRole('button', { name: 'Send draft' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.zc-button__label')).toHaveTextContent('Send draft');
    expect(button.querySelector('.zc-button__overlay')).toBeInTheDocument();
  });

  it('briefly morphs to a check then returns to the label', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Button success={false}>Approve</Button>);
    rerender(<Button success>Approve</Button>);
    expect(screen.getByRole('button').querySelector('.zc-button__overlay')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('button').querySelector('.zc-button__overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Approve');
  });

  it('does not fire while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Send
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
