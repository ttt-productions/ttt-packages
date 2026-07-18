import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DatePicker } from '../src/react/components/date-picker';

// Fixed, timezone-agnostic construction (local midnight).
const d = (y: number, m1: number, day: number) => new Date(y, m1 - 1, day);

const monthTrigger = (monthName: string) =>
  screen.getByRole('button', { name: `Choose month, currently ${monthName}` });
const yearTrigger = (year: number) =>
  screen.getByRole('button', { name: `Choose year, currently ${year}` });
const dayButton = (label: string) => screen.getByRole('button', { name: label });

afterEach(() => {
  vi.useRealTimers();
});

describe('DatePicker', () => {
  describe('day selection', () => {
    it('calls onSelect with the clicked date and does not fire for month/year picks', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<DatePicker selected={d(1990, 8, 15)} onSelect={onSelect} />);

      await user.click(dayButton('August 15, 1990'));
      expect(onSelect).toHaveBeenCalledTimes(1);
      const picked = onSelect.mock.calls[0][0] as Date;
      expect(picked.getFullYear()).toBe(1990);
      expect(picked.getMonth()).toBe(7);
      expect(picked.getDate()).toBe(15);

      // A month pick changes the view, never commits.
      await user.click(monthTrigger('August'));
      await user.click(screen.getByRole('button', { name: 'July 1990' }));
      expect(onSelect).toHaveBeenCalledTimes(1);

      // A year pick changes the view, never commits.
      await user.click(yearTrigger(1990));
      await user.click(screen.getByRole('button', { name: 'Year 1985' }));
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('month is an independent picker', () => {
    it('returns to the day grid and preserves the year', async () => {
      const user = userEvent.setup();
      render(<DatePicker selected={d(1990, 8, 15)} />);

      await user.click(monthTrigger('August'));
      await user.click(screen.getByRole('button', { name: 'March 1990' }));

      // Back on days: year preserved, month changed to March.
      expect(dayButton('March 1, 1990')).toBeInTheDocument();
      expect(monthTrigger('March')).toBeInTheDocument();
      expect(yearTrigger(1990)).toBeInTheDocument();
      // The month grid is gone.
      expect(screen.queryByRole('button', { name: 'March 1990' })).not.toBeInTheDocument();
    });

    it('moves focus to the Month trigger after picking', async () => {
      const user = userEvent.setup();
      render(<DatePicker selected={d(1990, 8, 15)} />);
      await user.click(monthTrigger('August'));
      await user.click(screen.getByRole('button', { name: 'May 1990' }));
      expect(monthTrigger('May')).toHaveFocus();
    });
  });

  describe('year is an independent picker', () => {
    it('returns DIRECTLY to the day grid preserving the month and never opens months', async () => {
      const user = userEvent.setup();
      render(<DatePicker selected={d(1990, 8, 15)} />);

      await user.click(yearTrigger(1990));
      await user.click(screen.getByRole('button', { name: 'Year 1985' }));

      // Straight back to days: month preserved (August), year now 1985.
      expect(dayButton('August 1, 1985')).toBeInTheDocument();
      expect(yearTrigger(1985)).toBeInTheDocument();
      expect(monthTrigger('August')).toBeInTheDocument();
      // Crucially, the month grid did NOT open.
      expect(screen.queryByRole('button', { name: 'August 1985' })).not.toBeInTheDocument();
    });

    it('moves focus to the Year trigger after picking', async () => {
      const user = userEvent.setup();
      render(<DatePicker selected={d(1990, 8, 15)} />);
      await user.click(yearTrigger(1990));
      await user.click(screen.getByRole('button', { name: 'Year 1988' }));
      expect(yearTrigger(1988)).toHaveFocus();
    });
  });

  describe('focus on opening a chooser', () => {
    it('opening months focuses the active month; opening years focuses the active year', async () => {
      const user = userEvent.setup();
      render(<DatePicker selected={d(1990, 8, 15)} />);

      await user.click(monthTrigger('August'));
      expect(screen.getByRole('button', { name: 'August 1990' })).toHaveFocus();

      // Toggle back to days, then open years.
      await user.click(monthTrigger('August'));
      await user.click(yearTrigger(1990));
      expect(screen.getByRole('button', { name: 'Year 1990' })).toHaveFocus();
    });
  });

  describe('controlled selected resync', () => {
    it('follows a new selected prop to that month/year', () => {
      const { rerender } = render(<DatePicker selected={d(1990, 8, 15)} />);
      expect(monthTrigger('August')).toBeInTheDocument();
      expect(yearTrigger(1990)).toBeInTheDocument();

      rerender(<DatePicker selected={d(1975, 3, 3)} />);
      expect(monthTrigger('March')).toBeInTheDocument();
      expect(yearTrigger(1975)).toBeInTheDocument();
      expect(dayButton('March 3, 1975')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('selected and today semantics', () => {
    it('exposes the selected day via aria-pressed and today via aria-current', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(1990, 7, 20, 12, 0, 0));

      render(<DatePicker selected={d(1990, 8, 15)} />);

      expect(dayButton('August 15, 1990')).toHaveAttribute('aria-pressed', 'true');
      expect(dayButton('August 16, 1990')).toHaveAttribute('aria-pressed', 'false');
      expect(dayButton('August 20, 1990')).toHaveAttribute('aria-current', 'date');
      expect(dayButton('August 15, 1990')).not.toHaveAttribute('aria-current');
    });

    it('gives every day a full-date accessible name', () => {
      render(<DatePicker selected={d(1990, 8, 15)} />);
      expect(dayButton('August 1, 1990')).toBeInTheDocument();
      expect(dayButton('August 31, 1990')).toBeInTheDocument();
    });
  });

  describe('disabled dates and range-nav disabling', () => {
    it('disables future days, whole-future nav, and future years under disableFuture', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2020, 5, 15, 12, 0, 0)); // 15 Jun 2020

      render(<DatePicker selected={d(2020, 6, 15)} disableFuture />);

      // Days
      expect(dayButton('June 14, 2020')).toBeEnabled();
      expect(dayButton('June 16, 2020')).toBeDisabled();

      // Header nav in days view: next month (fully future) disabled, prev enabled.
      expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Previous month' })).toBeEnabled();
    });

    it('disables future years and the whole-future year page', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2020, 5, 15, 12, 0, 0));
      const user = userEvent.setup();

      render(<DatePicker selected={d(2020, 6, 15)} disableFuture />);
      // Open years (page 2016–2027).
      await user.click(screen.getByRole('button', { name: 'Choose year, currently 2020' }));

      expect(screen.getByRole('button', { name: 'Year 2019' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Year 2020' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Year 2021' })).toBeDisabled();
      // Next page (2028–2039) is wholly future.
      expect(screen.getByRole('button', { name: `Next ${12} years` })).toBeDisabled();
      expect(screen.getByRole('button', { name: `Previous ${12} years` })).toBeEnabled();
    });

    it('honors a consumer disabled predicate for pointer selection', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <DatePicker
          selected={d(1990, 8, 15)}
          onSelect={onSelect}
          disabled={(date) => date.getDate() === 10}
        />,
      );
      expect(dayButton('August 10, 1990')).toBeDisabled();
      await user.click(dayButton('August 10, 1990'));
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('keyboard day movement', () => {
    it('moves the roving day with arrows and selects with Enter/Space', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<DatePicker selected={d(1990, 8, 15)} onSelect={onSelect} />);

      const start = dayButton('August 15, 1990');
      start.focus();
      expect(start).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(dayButton('August 16, 1990')).toHaveFocus();

      await user.keyboard('{ArrowDown}'); // +7 days
      expect(dayButton('August 23, 1990')).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalled();
      const picked = onSelect.mock.calls.at(-1)![0] as Date;
      expect(picked.getMonth()).toBe(7);
      expect(picked.getDate()).toBe(23);
    });

    it('crosses month boundaries with PageDown and updates the header', async () => {
      const user = userEvent.setup();
      render(<DatePicker selected={d(1990, 8, 15)} />);
      dayButton('August 15, 1990').focus();

      await user.keyboard('{PageDown}'); // → September 15
      expect(dayButton('September 15, 1990')).toHaveFocus();
      expect(monthTrigger('September')).toBeInTheDocument();
    });

    it('keeps exactly one day in the tab order', () => {
      render(<DatePicker selected={d(1990, 8, 15)} />);
      const roving = screen.getAllByRole('button').filter((b) => b.getAttribute('tabindex') === '0');
      // Only the roving day carries tabindex 0 (header triggers/arrows are naturally tabbable, not tabindex-0-annotated).
      const dayZeroTab = screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('aria-label')?.includes('1990') && b.getAttribute('tabindex') === '0');
      expect(roving.length).toBe(1);
      expect(dayZeroTab).toHaveLength(1);
      expect(dayZeroTab[0]).toHaveAccessibleName('August 15, 1990');
    });
  });

  describe('repeat interactions and unmount safety', () => {
    it('handles repeated open/pick cycles and unmounts cleanly', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      const onSelect = vi.fn();

      function Harness() {
        const [sel, setSel] = useState<Date | undefined>(d(1990, 8, 15));
        return (
          <DatePicker
            selected={sel}
            onSelect={(date) => {
              onSelect(date);
              setSel(date);
            }}
          />
        );
      }

      const { unmount } = render(<Harness />);

      for (let i = 0; i < 3; i++) {
        await user.click(monthTrigger(i === 0 ? 'August' : 'February'));
        await user.click(screen.getByRole('button', { name: 'February 1990' }));
        await user.click(yearTrigger(1990));
        await user.click(screen.getByRole('button', { name: 'Year 1990' }));
        await user.click(dayButton('February 15, 1990'));
      }
      expect(onSelect).toHaveBeenCalled();

      unmount();
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
