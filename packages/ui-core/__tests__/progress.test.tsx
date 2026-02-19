import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Progress } from '../src/components/progress';

describe('Progress', () => {
  it('renders without crashing', () => {
    const { container } = render(<Progress />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('accepts value prop', () => {
    const { container } = render(<Progress value={50} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(<Progress className="my-progress" />);
    expect(container.firstChild).toHaveClass('my-progress');
  });

  it('renders indicator element', () => {
    const { container } = render(<Progress value={75} />);
    const indicator = container.querySelector('[style]');
    expect(indicator).toBeInTheDocument();
  });

  it('indicator style reflects value', () => {
    const { container } = render(<Progress value={60} />);
    const indicator = container.querySelector('[style*="translateX"]');
    expect(indicator).toBeInTheDocument();
    // translateX(-40%) for value=60
    expect((indicator as HTMLElement).style.transform).toContain('translateX(-40%)');
  });

  it('indicator style at 0 value', () => {
    const { container } = render(<Progress value={0} />);
    const indicator = container.querySelector('[style*="translateX"]');
    expect((indicator as HTMLElement).style.transform).toContain('translateX(-100%)');
  });

  it('indicator style at 100 value', () => {
    const { container } = render(<Progress value={100} />);
    const indicator = container.querySelector('[style*="translateX"]');
    expect((indicator as HTMLElement).style.transform).toContain('translateX(-0%)');
  });

  it('accepts indicatorClassName', () => {
    const { container } = render(<Progress value={50} indicatorClassName="bg-green-500" />);
    const indicator = container.querySelector('.bg-green-500');
    expect(indicator).toBeInTheDocument();
  });
});
