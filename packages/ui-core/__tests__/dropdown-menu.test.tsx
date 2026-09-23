import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../src/react/components/dropdown-menu';

function renderOpenMenu(item: React.ReactNode) {
  return render(
    <DropdownMenu open modal={false}>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>{item}</DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe('DropdownMenuItem', () => {
  it('renders its leading icon when idle', () => {
    renderOpenMenu(<DropdownMenuItem icon={<svg data-testid="item-icon" />}>Hide this work</DropdownMenuItem>);
    const item = screen.getByRole('menuitem', { name: 'Hide this work' });
    expect(item).toContainElement(screen.getByTestId('item-icon'));
    expect(item).not.toHaveAttribute('aria-busy');
  });

  it('pending: swaps the icon for the spinner, disables the item, and ignores selection', () => {
    const onSelect = vi.fn();
    renderOpenMenu(
      <DropdownMenuItem pending icon={<svg data-testid="item-icon" />} onSelect={onSelect}>
        Hide this work
      </DropdownMenuItem>,
    );
    const item = screen.getByRole('menuitem', { name: 'Hide this work' });
    expect(screen.queryByTestId('item-icon')).toBeNull();
    expect(item.querySelector('.spinner-xs')).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-busy', 'true');
    expect(item).toHaveAttribute('data-disabled');
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
