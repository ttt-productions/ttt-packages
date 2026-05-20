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
});
