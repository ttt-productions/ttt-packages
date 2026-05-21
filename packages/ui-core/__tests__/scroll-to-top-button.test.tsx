import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import * as React from 'react';
import { ScrollToTopButton } from '../src/react/components/scroll-to-top-button';

beforeEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
});

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
});

describe('ScrollToTopButton', () => {
  it('renders a button with default aria-label', () => {
    render(<ScrollToTopButton />);
    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
  });

  it('is not visible (opacity-0) when scrollY is below threshold', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    render(<ScrollToTopButton threshold={400} />);
    const btn = screen.getByRole('button', { name: 'Scroll to top' });
    expect(btn.className).toContain('opacity-0');
  });

  it('becomes visible when scrollY exceeds threshold', () => {
    render(<ScrollToTopButton threshold={400} />);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    const btn = screen.getByRole('button', { name: 'Scroll to top' });
    expect(btn.className).toContain('opacity-100');
  });

  it('accepts a custom aria-label', () => {
    render(<ScrollToTopButton ariaLabel="Back to top" />);
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument();
  });

  it('accepts a custom icon', () => {
    render(<ScrollToTopButton icon={<span data-testid="custom-up">↑</span>} />);
    expect(screen.getByTestId('custom-up')).toBeInTheDocument();
  });

  it('forwards variant prop to the underlying Button', () => {
    render(<ScrollToTopButton variant="inverted" />);
    const btn = screen.getByRole('button', { name: 'Scroll to top' });
    // The inverted variant adds bg-[hsl(var(--inverted-background))] via buttonVariants.
    expect(btn.className).toContain('inverted-background');
  });

  it('uses size="icon" by default and accepts a size override', () => {
    const { rerender } = render(<ScrollToTopButton />);
    const defaultBtn = screen.getByRole('button', { name: 'Scroll to top' });
    // Button's size="icon" => h-9 w-9
    expect(defaultBtn.className).toContain('h-9');

    rerender(<ScrollToTopButton size="lg" />);
    const lgBtn = screen.getByRole('button', { name: 'Scroll to top' });
    // Button's size="lg" => h-11
    expect(lgBtn.className).toContain('h-11');
  });
});
