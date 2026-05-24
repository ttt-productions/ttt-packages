import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Checkbox } from '../src/react/components/checkbox';

describe('Checkbox', () => {
  it('renders without crashing', () => {
    const { container } = render(<Checkbox />);
    expect(container.firstChild).not.toBeNull();
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Checkbox className="my-checkbox" />);
    const root = container.firstChild as HTMLElement;
    expect(root?.className).toContain('my-checkbox');
  });

  it('renders a button element (Radix Checkbox root is a button)', () => {
    const { container } = render(<Checkbox />);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
  });

  it('can be disabled', () => {
    const { container } = render(<Checkbox disabled />);
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
  });
});
