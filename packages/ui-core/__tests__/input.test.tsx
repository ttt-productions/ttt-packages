import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { Input } from '../src/components/input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('accepts type prop', () => {
    const { container } = render(<Input type="email" />);
    const input = container.querySelector('input');
    expect(input?.getAttribute('type')).toBe('email');
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Input className="my-class" />);
    const input = container.querySelector('input');
    expect(input?.className).toContain('my-class');
  });

  it('passes additional props to the input element', () => {
    render(<Input placeholder="Enter text" data-testid="my-input" />);
    expect(screen.getByTestId('my-input')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter text')).toBeDefined();
  });

  it('renders as disabled when disabled prop is set', () => {
    const { container } = render(<Input disabled />);
    const input = container.querySelector('input');
    expect(input?.disabled).toBe(true);
  });

  it('forwards ref to the input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('has displayName "Input"', () => {
    expect(Input.displayName).toBe('Input');
  });
});
