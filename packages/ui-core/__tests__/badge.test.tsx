import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../src/components/badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    const { container } = render(<Badge>Test</Badge>);
    expect(container.firstChild).toHaveClass('inline-flex');
  });

  it('accepts custom className', () => {
    const { container } = render(<Badge className="my-custom">Test</Badge>);
    expect(container.firstChild).toHaveClass('my-custom');
  });

  it('renders outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });
});
