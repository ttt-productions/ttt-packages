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

describe('DropdownMenuItem asChild (a link item)', () => {
  it('slots onto its child: the anchor itself is the menuitem and keeps its href', () => {
    renderOpenMenu(
      <DropdownMenuItem asChild>
        <a href="/x">Link</a>
      </DropdownMenuItem>,
    );
    const item = screen.getByRole('menuitem', { name: 'Link' });
    expect(item.tagName).toBe('A');
    expect(item).toHaveAttribute('href', '/x');
  });

  it('renders the leading icon inside the anchor, before the link text', () => {
    renderOpenMenu(
      <DropdownMenuItem asChild icon={<svg data-testid="item-icon" />}>
        <a href="/x">Link</a>
      </DropdownMenuItem>,
    );
    const item = screen.getByRole('menuitem', { name: 'Link' });
    expect(item.tagName).toBe('A');
    expect(item.firstChild).toBe(screen.getByTestId('item-icon'));
    expect(item.lastChild?.textContent).toBe('Link');
  });

  it('pending: the spinner replaces the icon inside the anchor, and the item is busy and disabled', () => {
    renderOpenMenu(
      <DropdownMenuItem asChild pending icon={<svg data-testid="item-icon" />}>
        <a href="/x">Link</a>
      </DropdownMenuItem>,
    );
    const item = screen.getByRole('menuitem', { name: 'Link' });
    expect(item.tagName).toBe('A');
    expect(screen.queryByTestId('item-icon')).toBeNull();
    expect(item.firstElementChild).toHaveClass('spinner-xs');
    expect(item).toHaveAttribute('aria-busy', 'true');
    expect(item).toHaveAttribute('data-pending');
    expect(item).toHaveAttribute('data-disabled');
    expect(item).toHaveAttribute('aria-disabled', 'true');
  });
});
