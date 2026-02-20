import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { Textarea } from '../src/components/textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    const { container } = render(<Textarea />);
    expect(container.querySelector('textarea')).toBeDefined();
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Textarea className="custom-class" />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('custom-class');
  });

  it('accepts placeholder prop', () => {
    render(<Textarea placeholder="Write here..." />);
    expect(screen.getByPlaceholderText('Write here...')).toBeDefined();
  });

  it('passes additional props', () => {
    render(<Textarea data-testid="my-textarea" />);
    expect(screen.getByTestId('my-textarea')).toBeDefined();
  });

  it('renders as disabled when disabled prop is set', () => {
    const { container } = render(<Textarea disabled />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.disabled).toBe(true);
  });

  it('forwards ref to the textarea element', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('has displayName "Textarea"', () => {
    expect(Textarea.displayName).toBe('Textarea');
  });
});
