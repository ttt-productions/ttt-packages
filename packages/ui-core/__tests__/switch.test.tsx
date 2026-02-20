import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Switch } from '../src/components/switch';

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

  it('has a displayName set', () => {
    expect(typeof Switch.displayName).toBe('string');
    expect(Switch.displayName!.length).toBeGreaterThan(0);
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
});
