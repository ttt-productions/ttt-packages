import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Switch } from '../src/react/components/switch';

describe('Switch', () => {
  it('renders without crashing', () => {
    const { container } = render(<Switch />);
    expect(container.firstChild).not.toBeNull();
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Switch className="my-switch" />);
    const root = container.firstChild as HTMLElement;
    expect(root?.className).toContain('my-switch');
  });

  it('renders a button element (Radix Switch root is a button)', () => {
    const { container } = render(<Switch />);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
  });

  it('can be disabled', () => {
    const { container } = render(<Switch disabled />);
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
  });

  it('pending: disables, marks busy, spins inside the thumb, and keeps the committed state', () => {
    const { container } = render(<Switch checked pending />);
    const root = container.querySelector('button') as HTMLButtonElement;
    expect(root.disabled).toBe(true);
    expect(root).toHaveAttribute('aria-busy', 'true');
    expect(root).toHaveAttribute('data-state', 'checked');
    expect(root.querySelector('.spinner-xs')).toBeInTheDocument();
  });

  it('not pending: no spinner and no busy attribute', () => {
    const { container } = render(<Switch />);
    const root = container.querySelector('button') as HTMLButtonElement;
    expect(root).not.toHaveAttribute('aria-busy');
    expect(root.querySelector('.spinner-xs')).toBeNull();
  });
});
