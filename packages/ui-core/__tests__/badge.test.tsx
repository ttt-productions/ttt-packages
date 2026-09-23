import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from '../src/react/components/badge';

// A solid status fill carries ITS OWN status foreground, and no other text colour at rest.
const TEXT_NOT_A_COLOUR = /^text-(xs|sm|base|lg|\d*xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/;
const restingTextColours = (classes: string) =>
  classes.split(/\s+/).filter((c) => c.startsWith('text-') && !TEXT_NOT_A_COLOUR.test(c));

describe('Badge — a status fill carries its own status foreground', () => {
  it('variant="destructive" pairs bg-destructive with text-destructive-foreground and no other text colour', () => {
    const classes = badgeVariants({ variant: 'destructive' });
    expect(classes.split(/\s+/)).toContain('bg-destructive');
    expect(restingTextColours(classes)).toEqual(['text-destructive-foreground']);
  });

  it('the rendered destructive badge carries the destructive foreground', () => {
    const { container } = render(<Badge variant="destructive">Removed</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-destructive', 'text-destructive-foreground');
    expect(restingTextColours(badge.className)).toEqual(['text-destructive-foreground']);
  });
});

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
