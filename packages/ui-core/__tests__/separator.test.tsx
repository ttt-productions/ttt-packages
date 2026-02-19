import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Separator } from '../src/components/separator';

describe('Separator', () => {
  it('renders without crashing', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('is horizontal by default', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toHaveClass('h-[2px]', 'w-full');
  });

  it('renders vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.firstChild).toHaveClass('w-[1px]', 'h-full');
  });

  it('accepts custom className', () => {
    const { container } = render(<Separator className="my-sep" />);
    expect(container.firstChild).toHaveClass('my-sep');
  });
});
