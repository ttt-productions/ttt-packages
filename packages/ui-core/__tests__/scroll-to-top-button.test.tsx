import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ScrollToTopButton } from '../src/react/components/scroll-to-top-button.js';

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
    expect(btn.className).toContain('inverted-background');
  });

  it('uses size="icon" by default and accepts a size override', () => {
    const { rerender } = render(<ScrollToTopButton />);
    const defaultBtn = screen.getByRole('button', { name: 'Scroll to top' });
    expect(defaultBtn.className).toContain('h-9');

    rerender(<ScrollToTopButton size="lg" />);
    const lgBtn = screen.getByRole('button', { name: 'Scroll to top' });
    expect(lgBtn.className).toContain('h-11');
  });
});

describe('ScrollToTopButton — rest-prop passthrough', () => {
  it('forwards an arbitrary data-* attribute through to the rendered button', () => {
    render(<ScrollToTopButton data-tour-anchor="scroll-top" />);
    const btn = screen.getByRole('button', { name: 'Scroll to top' });
    expect(btn).toHaveAttribute('data-tour-anchor', 'scroll-top');
  });

  it('forwards a standard button attribute (id) alongside the component classes', () => {
    render(<ScrollToTopButton id="to-top" />);
    const btn = screen.getByRole('button', { name: 'Scroll to top' });
    expect(btn).toHaveAttribute('id', 'to-top');
    expect(btn.className).toContain('fixed');
  });

  it("preserves the component's own aria-label and scroll onClick when passthrough props are supplied", () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      render(<ScrollToTopButton data-tour-anchor="scroll-top" />);
      const btn = screen.getByRole('button', { name: 'Scroll to top' });
      fireEvent.click(btn);
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    } finally {
      scrollToSpy.mockRestore();
    }
  });

  it('merges a consumer className rather than replacing the component classes', () => {
    render(<ScrollToTopButton className="my-anchor-class" />);
    const btn = screen.getByRole('button', { name: 'Scroll to top' });
    expect(btn).toHaveClass('my-anchor-class');
    expect(btn.className).toContain('fixed');
    expect(btn.className).toContain('rounded-full');
  });
});

describe('ScrollToTopButton — scrollBehavior', () => {
  it('defaults to smooth scroll when scrollBehavior is not provided', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      render(<ScrollToTopButton />);
      const btn = screen.getByRole('button', { name: 'Scroll to top' });
      fireEvent.click(btn);
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    } finally {
      scrollToSpy.mockRestore();
    }
  });

  it('passes behavior "auto" through to window.scrollTo when scrollBehavior="auto"', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      render(<ScrollToTopButton scrollBehavior="auto" />);
      const btn = screen.getByRole('button', { name: 'Scroll to top' });
      fireEvent.click(btn);
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    } finally {
      scrollToSpy.mockRestore();
    }
  });

  it('forwards an explicit scrollBehavior="smooth" unchanged', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      render(<ScrollToTopButton scrollBehavior="smooth" />);
      const btn = screen.getByRole('button', { name: 'Scroll to top' });
      fireEvent.click(btn);
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    } finally {
      scrollToSpy.mockRestore();
    }
  });
});
