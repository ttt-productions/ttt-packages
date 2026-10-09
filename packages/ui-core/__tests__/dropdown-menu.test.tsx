import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../src/react/components/dropdown-menu';
import { Button } from '../src/react/components/button';

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

  it('pending: swaps the icon for the spinner, marks the item unavailable, and ignores selection', () => {
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
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).not.toHaveAttribute('data-disabled');
    fireEvent.click(item);
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pending: stays in the menu focus order — ArrowDown from the item above lands on it', async () => {
    renderOpenMenu(
      <>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem pending>Hide this work</DropdownMenuItem>
        <DropdownMenuItem>Share</DropdownMenuItem>
      </>,
    );
    const above = screen.getByRole('menuitem', { name: 'Edit' });
    above.focus();
    fireEvent.keyDown(above, { key: 'ArrowDown' });
    // The menu moves focus on the next task.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('menuitem', { name: 'Hide this work' })).toHaveFocus();
  });
});

describe('a pending Button as a menu trigger (asChild)', () => {
  function renderTrigger(pending: boolean, onKeyDown = vi.fn()) {
    return render(
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button pending={pending} onKeyDown={onKeyDown}>Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
  }

  it('opens on no activation key and no pointer press, and the caller key handler does not run', () => {
    const onKeyDown = vi.fn();
    renderTrigger(true, onKeyDown);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    trigger.focus();
    for (const key of ['Enter', ' ', 'ArrowDown']) fireEvent.keyDown(trigger, { key });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveAttribute('data-state', 'closed');
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('lets Tab and function keys through', () => {
    const onKeyDown = vi.fn();
    renderTrigger(true, onKeyDown);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(fireEvent.keyDown(trigger, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(trigger, { key: 'F5' })).toBe(true);
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('opens on ArrowDown when not pending', () => {
    renderTrigger(false);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('data-state', 'open');
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

  it('pending: the spinner replaces the icon inside the anchor, and the item is busy and unavailable but goes nowhere', () => {
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
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(fireEvent.click(item)).toBe(false);
  });
});
