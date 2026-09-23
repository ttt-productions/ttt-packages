import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../src/react/components/spinner';

describe('Spinner', () => {
  it('defaults to the in-control size and is decorative (aria-hidden) without a label', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('spinner-xs');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    ['xs', 'spinner-xs'],
    ['sm', 'spinner-sm'],
    ['md', 'spinner-md'],
    ['lg', 'spinner-lg'],
    ['xl', 'spinner-xl'],
  ] as const)('size="%s" maps onto the theme-core %s class', (size, cls) => {
    const { container } = render(<Spinner size={size} />);
    expect(container.querySelector('svg')).toHaveClass(cls);
  });

  it('with a label it becomes a status region that announces the label', () => {
    render(<Spinner size="lg" label="Loading messages" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading messages');
    expect(status.querySelector('svg')).toHaveClass('spinner-lg');
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('merges a caller className onto the outermost element', () => {
    const { container, rerender } = render(<Spinner className="mx-auto" />);
    expect(container.querySelector('svg')).toHaveClass('mx-auto');

    rerender(<Spinner label="Loading" className="mx-auto" />);
    expect(screen.getByRole('status')).toHaveClass('mx-auto');
  });
});
