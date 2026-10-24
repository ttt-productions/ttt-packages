import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from '../src/react/components/progress.js';

const indicatorOf = (bar: HTMLElement) => bar.firstElementChild as HTMLElement;

describe('Progress', () => {
  it('reports its value to assistive technology and draws the bar to it', () => {
    render(<Progress value={60} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('data-state', 'loading');
    expect(indicatorOf(bar).style.transform).toBe('translateX(-40%)');
  });

  it('reports complete at its max', () => {
    render(<Progress value={100} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('data-state', 'complete');
    expect(indicatorOf(bar).style.transform).toBe('translateX(-0%)');
  });

  it('clamps a value past its max to the max, and below zero to zero', () => {
    const { unmount } = render(<Progress value={150} />);
    let bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(indicatorOf(bar).style.transform).toBe('translateX(-0%)');
    unmount();

    render(<Progress value={-20} />);
    bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(indicatorOf(bar).style.transform).toBe('translateX(-100%)');
  });

  it('measures against a custom max', () => {
    render(<Progress value={3} max={4} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(indicatorOf(bar).style.transform).toBe('translateX(-25%)');
  });

  it('with no value reports indeterminate, never a made-up 0', () => {
    render(<Progress />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAttribute('data-state', 'indeterminate');
  });

  it("keeps a caller's spoken value text over the default percentage", () => {
    render(<Progress value={30} aria-valuetext="$3,000 raised of $10,000" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '$3,000 raised of $10,000',
    );
  });

  it('applies its class names to the bar and the indicator', () => {
    render(<Progress value={50} className="my-progress" indicatorClassName="goal-indicator" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveClass('my-progress');
    expect(indicatorOf(bar)).toHaveClass('goal-indicator');
  });
});
