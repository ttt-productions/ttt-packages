import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Switch } from '../src/react/components/switch';

describe('Switch', () => {
  it('renders without crashing', () => {
    const { container } = render(<Switch />);
    expect(container.firstChild).not.toBeNull();
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Switch className="my-switch" />);
    const root = container.firstChild as HTMLElement;
    expect(root?.className).toContain('my-switch');
  });

  it('renders a button element (Radix Switch root is a button)', () => {
    const { container } = render(<Switch />);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
  });

  it('can be disabled', () => {
    const { container } = render(<Switch disabled />);
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
  });

  it('pending: marks itself unavailable and busy, spins inside the thumb, and keeps the committed state', () => {
    const { container } = render(<Switch checked pending />);
    const root = container.querySelector('button') as HTMLButtonElement;
    expect(root).toHaveAttribute('aria-disabled', 'true');
    expect(root).toHaveAttribute('aria-busy', 'true');
    expect(root).toHaveAttribute('data-state', 'checked');
    expect(root.querySelector('.spinner-xs')).toBeInTheDocument();
  });

  it('pending: keeps focus on the switch the user just pressed', () => {
    const { container, rerender } = render(<Switch checked={false} onCheckedChange={() => {}} />);
    const root = container.querySelector('button') as HTMLButtonElement;
    root.focus();
    rerender(<Switch checked={false} onCheckedChange={() => {}} pending />);
    expect(root.disabled).toBe(false);
    expect(root).toHaveFocus();
  });

  it('pending: a press toggles nothing and reaches no click handler', () => {
    const onCheckedChange = vi.fn();
    const onClick = vi.fn();
    const { container } = render(
      <Switch checked={false} onCheckedChange={onCheckedChange} onClick={onClick} pending />,
    );
    const root = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(root);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(root).toHaveAttribute('data-state', 'unchecked');
  });

  it('pending and disabled: stays natively disabled', () => {
    const { container } = render(<Switch pending disabled />);
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('not pending: toggles on a press', () => {
    const onCheckedChange = vi.fn();
    const { container } = render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('not pending: no spinner and no busy attribute', () => {
    const { container } = render(<Switch />);
    const root = container.querySelector('button') as HTMLButtonElement;
    expect(root).not.toHaveAttribute('aria-busy');
    expect(root).not.toHaveAttribute('aria-disabled');
    expect(root.querySelector('.spinner-xs')).toBeNull();
  });
});
