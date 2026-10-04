import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchDropdown } from '../src/react/components/search-dropdown';

interface Person {
  name: string;
}

interface HarnessProps {
  results?: Person[];
  isLoading?: boolean;
  error?: unknown;
  label?: string;
  initialValue?: string;
  onSelect?: (person: Person) => void;
  onClear?: () => void;
  renderError?: (error: unknown) => React.ReactNode;
}

// A consumer that hands the dropdown a fresh results array on every render, as a query hook's
// `data ?? []` default does.
function Harness({ results, isLoading = false, error = null, label, initialValue = '', onSelect, onClear, renderError }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <SearchDropdown<Person>
      value={value}
      onValueChange={setValue}
      results={results ? [...results] : []}
      isLoading={isLoading}
      error={error}
      renderError={renderError ?? (() => <div>search failed</div>)}
      onSelect={onSelect ?? (() => {})}
      onClear={onClear}
      label={label}
      emptyMessage="Nobody found"
      renderResult={(person) => <span>{person.name}</span>}
    />
  );
}

const PEOPLE: Person[] = [{ name: 'Ada' }, { name: 'Alan' }, { name: 'Grace' }];

describe('SearchDropdown keeps a settled search open', () => {
  it('shows the empty message for a settled search with no results', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent('Nobody found');
  });

  it('moves from searching to the empty message without closing', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness isLoading />);
    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent('Searching...');
    rerender(<Harness isLoading={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Nobody found');
  });

  it('moves from results to the empty message without closing', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness results={PEOPLE} />);
    await user.type(screen.getByRole('combobox'), 'ada');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    rerender(<Harness results={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Nobody found');
  });

  it("hands a failed search's raw error to the consumer's renderError", async () => {
    const user = userEvent.setup();
    const failure = new Error('permission-denied');
    const renderError = vi.fn((error: unknown) => <div>could not search: {(error as Error).message}</div>);
    render(<Harness error={failure} renderError={renderError} />);
    await user.type(screen.getByRole('combobox'), 'ada');
    expect(screen.getByText('could not search: permission-denied')).toBeInTheDocument();
    expect(renderError).toHaveBeenLastCalledWith(failure);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the minimum-length hint below the minimum and describes the input with it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'ab');
    const hint = screen.getByText('Type at least 3 characters to search');
    expect(input).toHaveAttribute('aria-describedby', hint.id);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('SearchDropdown dismissal holds for the value it was made on', () => {
  it('Escape closes it, keeps focus in the input, and re-rendered props do not reopen it', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'zzz');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
    rerender(<Harness />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('typing reopens it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'zzz');
    await user.keyboard('{Escape}');
    await user.type(input, 'z');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('ArrowDown reopens it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('combobox'), 'zzz');
    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('a click outside closes it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">elsewhere</button>
        <Harness />
      </div>,
    );
    await user.type(screen.getByRole('combobox'), 'zzz');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('SearchDropdown combobox semantics', () => {
  it('is a combobox that controls its results listbox while results show', async () => {
    const user = userEvent.setup();
    render(<Harness results={PEOPLE} label="Find a person" />);
    const input = screen.getByRole('combobox', { name: 'Find a person' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.type(input, 'ada');
    const listbox = screen.getByRole('listbox', { name: 'Find a person' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ada', 'Alan', 'Grace']);
  });

  it('announces the arrow-highlighted option as the active descendant, and Enter selects it', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness results={PEOPLE} onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'ada');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{ArrowDown}{ArrowDown}');
    const alan = screen.getByRole('option', { name: 'Alan' });
    expect(input).toHaveAttribute('aria-activedescendant', alan.id);
    expect(alan).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Ada' })).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Ada' }).id);

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith({ name: 'Ada' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('follows the pointer: hovering an option makes it the active descendant, and a click selects it', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness results={PEOPLE} onSelect={onSelect} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'gra');
    const grace = screen.getByRole('option', { name: 'Grace' });
    await user.hover(grace);
    expect(input).toHaveAttribute('aria-activedescendant', grace.id);
    await user.click(grace);
    expect(onSelect).toHaveBeenCalledWith({ name: 'Grace' });
    expect(input).toHaveFocus();
  });

  it('keeps the highlight when the same query re-renders its results, and drops it for a new query', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness results={PEOPLE} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'ada');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    rerender(<Harness results={PEOPLE} />);
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Alan' }).id);
    await user.type(input, 'm');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('gives two mounted instances their own ids, each label naming its own input and listbox', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness results={PEOPLE} label="First search" />
        <Harness results={PEOPLE} label="Second search" />
      </>,
    );
    const first = screen.getByLabelText('First search');
    const second = screen.getByLabelText('Second search');
    expect(first).not.toBe(second);
    expect(first.id).not.toBe(second.id);

    await user.type(first, 'ada');
    const firstList = screen.getByRole('listbox', { name: 'First search' });
    expect(first).toHaveAttribute('aria-controls', firstList.id);
    const firstOptionIds = screen.getAllByRole('option').map((option) => option.id);

    // Clicking into the second input is a click outside the first, which closes it.
    await user.type(second, 'ada');
    expect(screen.queryByRole('listbox', { name: 'First search' })).not.toBeInTheDocument();
    const secondList = screen.getByRole('listbox', { name: 'Second search' });
    expect(second).toHaveAttribute('aria-controls', secondList.id);
    expect(secondList.id).not.toBe(firstList.id);
    const secondOptionIds = screen.getAllByRole('option').map((option) => option.id);

    const ids = [...firstOptionIds, ...secondOptionIds];
    expect(new Set(ids).size).toBe(6);
  });
});

describe('SearchDropdown recovery, clearing, and announcements', () => {
  it('a failed search that recovers shows its results again', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness error={new Error('offline')} />);
    await user.type(screen.getByRole('combobox'), 'ada');
    expect(screen.getByText('search failed')).toBeInTheDocument();
    rerender(<Harness error={null} results={PEOPLE} />);
    expect(screen.queryByText('search failed')).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('the clear button empties the value, calls onClear, and keeps focus in the input', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Harness results={PEOPLE} onClear={onClear} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'ada');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
  });

  it('Escape on a closed dropdown clears the value through onClear', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Harness onClear={onClear} />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'zzz');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('zzz');
    expect(onClear).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('a click selection closes the panel', async () => {
    const user = userEvent.setup();
    render(<Harness results={PEOPLE} />);
    await user.type(screen.getByRole('combobox'), 'ada');
    await user.click(screen.getByRole('option', { name: 'Alan' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('announces the result count through the always-present status region', async () => {
    const user = userEvent.setup();
    render(<Harness results={PEOPLE} />);
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    await user.type(screen.getByRole('combobox'), 'ada');
    expect(status).toHaveTextContent('3 results');
  });

  it('is expanded and controls the open panel while it shows an empty answer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.type(input, 'zzz');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(input.getAttribute('aria-controls')!);
    expect(panel).toHaveTextContent('Nobody found');
  });
});
