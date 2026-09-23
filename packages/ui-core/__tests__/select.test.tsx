import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select, SelectTrigger, SelectValue } from '../src/react/components/select';

function renderTrigger(pending?: boolean) {
  return render(
    <Select value="a">
      <SelectTrigger aria-label="Folder" pending={pending}>
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
    </Select>,
  );
}

describe('SelectTrigger', () => {
  it('pending: disables the trigger, marks it busy, and swaps the chevron for the spinner', () => {
    const { container } = renderTrigger(true);
    const trigger = screen.getByRole('combobox', { name: 'Folder' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.spinner-xs')).toBeInTheDocument();
    expect(container.querySelector('.lucide-chevron-down')).toBeNull();
  });

  it('not pending: shows the chevron, no spinner, no busy attribute', () => {
    const { container } = renderTrigger(false);
    const trigger = screen.getByRole('combobox', { name: 'Folder' });
    expect(trigger).toBeEnabled();
    expect(trigger).not.toHaveAttribute('aria-busy');
    expect(container.querySelector('.spinner-xs')).toBeNull();
    expect(container.querySelector('.lucide-chevron-down')).toBeInTheDocument();
  });
});
