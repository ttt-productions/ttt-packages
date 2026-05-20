import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { EndOfListIndicator } from '../src/react/components/end-of-list-indicator';

describe('EndOfListIndicator', () => {
  it('renders the default message', () => {
    render(<EndOfListIndicator />);
    expect(screen.getByText("You've reached the end!")).toBeInTheDocument();
  });

  it('renders a custom message', () => {
    render(<EndOfListIndicator message="No more items" />);
    expect(screen.getByText('No more items')).toBeInTheDocument();
  });

  it('renders a custom icon', () => {
    render(<EndOfListIndicator icon={<span data-testid="custom-icon">★</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EndOfListIndicator className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('renders without icon prop (uses default CheckCircle2)', () => {
    const { container } = render(<EndOfListIndicator />);
    // Default icon is an SVG (CheckCircle2)
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
