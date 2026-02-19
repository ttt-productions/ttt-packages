import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../src/components/label';

describe('Label', () => {
  it('renders children', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('renders as label element', () => {
    const { container } = render(<Label>Email</Label>);
    expect(container.querySelector('label')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(<Label className="my-label">Test</Label>);
    expect(container.querySelector('label')).toHaveClass('my-label');
  });

  it('has font-bold class from variants', () => {
    const { container } = render(<Label>Bold Label</Label>);
    expect(container.querySelector('label')).toHaveClass('font-bold');
  });

  it('associates with input via htmlFor', () => {
    render(
      <div>
        <Label htmlFor="test-input">Name</Label>
        <input id="test-input" />
      </div>
    );
    const label = screen.getByText('Name');
    expect(label).toHaveAttribute('for', 'test-input');
  });
});
