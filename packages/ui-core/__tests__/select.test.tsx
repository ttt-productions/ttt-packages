import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../src/react/components/select';

function renderTrigger(pending?: boolean, onOpenChange = vi.fn()) {
  return render(
    <Select value="a" onOpenChange={onOpenChange}>
      <SelectTrigger aria-label="Folder" pending={pending}>
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">A</SelectItem>
        <SelectItem value="b">B</SelectItem>
      </SelectContent>
    </Select>,
  );
}

describe('SelectTrigger', () => {
  it('pending: marks the trigger unavailable and busy, and swaps the chevron for the spinner', () => {
    const { container } = renderTrigger(true);
    const trigger = screen.getByRole('combobox', { name: 'Folder' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.spinner-xs')).toBeInTheDocument();
    expect(container.querySelector('.lucide-chevron-down')).toBeNull();
  });

  it('pending: keeps focus on the trigger and opens on no press or key', () => {
    const onOpenChange = vi.fn();
    renderTrigger(true, onOpenChange);
    const trigger = screen.getByRole('combobox', { name: 'Folder' });
    trigger.focus();
    expect(trigger).not.toBeDisabled();
    expect(trigger).toHaveFocus();
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'b' });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  it('pending: lets Tab, Escape, function keys, and shortcuts through', () => {
    renderTrigger(true);
    const trigger = screen.getByRole('combobox', { name: 'Folder' });
    expect(fireEvent.keyDown(trigger, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(trigger, { key: 'Escape' })).toBe(true);
    expect(fireEvent.keyDown(trigger, { key: 'F5' })).toBe(true);
    expect(fireEvent.keyDown(trigger, { key: 'Home' })).toBe(true);
    expect(fireEvent.keyDown(trigger, { key: 'r', ctrlKey: true })).toBe(true);
  });

  it('pending: stops Space, Enter, ArrowUp, ArrowDown, and a typeahead character', () => {
    renderTrigger(true);
    const trigger = screen.getByRole('combobox', { name: 'Folder' });
    for (const key of [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'b']) {
      expect(fireEvent.keyDown(trigger, { key })).toBe(false);
    }
  });

  it('not pending: opens on a key', () => {
    const onOpenChange = vi.fn();
    renderTrigger(false, onOpenChange);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Folder' }), { key: 'ArrowDown' });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('not pending: shows the chevron, no spinner, no busy attribute', () => {
    const { container } = renderTrigger(false);
    const trigger = screen.getByRole('combobox', { name: 'Folder' });
    expect(trigger).toBeEnabled();
    expect(trigger).not.toHaveAttribute('aria-busy');
    expect(trigger).not.toHaveAttribute('aria-disabled');
    expect(container.querySelector('.spinner-xs')).toBeNull();
    expect(container.querySelector('.lucide-chevron-down')).toBeInTheDocument();
  });
});
