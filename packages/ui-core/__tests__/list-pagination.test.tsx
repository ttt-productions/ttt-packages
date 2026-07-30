import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The ONE owner of list pagination: `ListPagination` (the Previous / counter /
// Next controls) plus the page-state hook for each flavor — `usePagedList`
// (client-side slice, known total) and `useCursorPage` (server/cursor feed,
// unknown total).
//
// Each hook and the control are exercised TOGETHER through a harness, because
// that is the only way they are ever used — the hook's state and the control's
// disabled/hidden semantics are one behavior.

import { usePagedList } from '../src/react/hooks/use-paged-list';
import { useCursorPage } from '../src/react/hooks/use-cursor-page';
import { ListPagination } from '../src/react/components/list-pagination';

const onPageChange = vi.fn();

function SliceHarness({
  items,
  pageSize,
  withCallback = false,
}: {
  items: string[];
  pageSize: number;
  withCallback?: boolean;
}) {
  const paged = usePagedList(items, pageSize, withCallback ? { onPageChange } : {});
  return (
    <div>
      <ul>
        {paged.pageItems.map((item) => (
          <li key={item} data-testid="row">
            {item}
          </li>
        ))}
      </ul>
      <ListPagination pagination={paged} />
    </div>
  );
}

function CursorHarness({
  hasMore,
  busy = false,
  withCallback = false,
  withReset = false,
}: {
  hasMore: boolean;
  busy?: boolean;
  withCallback?: boolean;
  withReset?: boolean;
}) {
  const pager = useCursorPage(hasMore, withCallback ? { onPageChange } : {});
  return (
    <div>
      {withReset && (
        <button type="button" onClick={pager.reset}>
          New filter
        </button>
      )}
      <ListPagination pagination={pager} busy={busy} />
    </div>
  );
}

function makeItems(count: number, startIndex = 1) {
  return Array.from({ length: count }, (_, i) => `item-${startIndex + i}`);
}

function visibleRows() {
  return screen.queryAllByTestId('row').map((el) => el.textContent);
}

const previous = () => screen.getByRole('button', { name: 'Previous' });
const next = () => screen.getByRole('button', { name: 'Next' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Known-total flavor: usePagedList + ListPagination
// ---------------------------------------------------------------------------

describe('usePagedList + ListPagination — page math', () => {
  it('slices the first page and reports the total page count', () => {
    render(<SliceHarness items={makeItems(7)} pageSize={3} />);

    expect(visibleRows()).toEqual(['item-1', 'item-2', 'item-3']);
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('walks forward through every page, the last holding only the remainder', async () => {
    const user = userEvent.setup();
    render(<SliceHarness items={makeItems(7)} pageSize={3} />);

    await user.click(next());
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-4', 'item-5', 'item-6']);

    await user.click(next());
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-7']);
  });

  it('walks back to the earlier slice', async () => {
    const user = userEvent.setup();
    render(<SliceHarness items={makeItems(7)} pageSize={3} />);

    await user.click(next());
    await user.click(previous());

    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-1', 'item-2', 'item-3']);
  });

  it('counts an exact multiple of the page size as no extra empty page', () => {
    render(<SliceHarness items={makeItems(6)} pageSize={3} />);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });
});

describe('usePagedList + ListPagination — edges', () => {
  it('disables Previous on the first page and Next on the last', async () => {
    const user = userEvent.setup();
    render(<SliceHarness items={makeItems(4)} pageSize={2} />);

    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();

    await user.click(next());

    expect(previous()).toBeEnabled();
    expect(next()).toBeDisabled();
  });

  it('renders no controls at all for a single page', () => {
    render(<SliceHarness items={makeItems(3)} pageSize={3} />);

    expect(visibleRows()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });

  it('renders no controls for an empty list', () => {
    render(<SliceHarness items={[]} pageSize={3} />);

    expect(visibleRows()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('clamps onto the last real page when the list shrinks under the open page', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SliceHarness items={makeItems(7)} pageSize={3} />);

    await user.click(next());
    await user.click(next());
    expect(screen.getByText('3 of 3')).toBeInTheDocument();

    // Rows are removed (deleted, or filtered out) while page 3 is open.
    rerender(<SliceHarness items={makeItems(4)} pageSize={3} />);

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-4']);
    expect(next()).toBeDisabled();
  });

  it('announces the page counter as a live status region', () => {
    render(<SliceHarness items={makeItems(7)} pageSize={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3');
  });
});

describe('usePagedList — onPageChange', () => {
  it('fires once per real page change', async () => {
    const user = userEvent.setup();
    render(<SliceHarness items={makeItems(7)} pageSize={3} withCallback />);

    await user.click(next());
    await user.click(previous());

    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it('never fires for a click that cannot move the page', async () => {
    const user = userEvent.setup();
    render(<SliceHarness items={makeItems(4)} pageSize={3} withCallback />);

    // Previous is disabled on page 1, so the click cannot advance anything.
    await user.click(previous());
    expect(onPageChange).not.toHaveBeenCalled();

    await user.click(next());
    expect(onPageChange).toHaveBeenCalledTimes(1);

    // Next is now disabled on the last page.
    await user.click(next());
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Unknown-total flavor: useCursorPage + ListPagination
// ---------------------------------------------------------------------------

describe('useCursorPage + ListPagination — page label and both directions', () => {
  it('labels the page without a total and starts on page 1 with Previous disabled', () => {
    render(<CursorHarness hasMore />);

    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
  });

  it('walks forward while more pages remain', async () => {
    const user = userEvent.setup();
    render(<CursorHarness hasMore />);

    await user.click(next());
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(previous()).toBeEnabled();

    await user.click(next());
    expect(screen.getByText('Page 3')).toBeInTheDocument();
  });

  it('walks back to the earlier page', async () => {
    const user = userEvent.setup();
    render(<CursorHarness hasMore />);

    await user.click(next());
    await user.click(previous());

    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
  });

  it('never walks past page 1', async () => {
    const user = userEvent.setup();
    render(<CursorHarness hasMore />);

    await user.click(previous());
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });

  it('announces the page counter as a live status region', () => {
    render(<CursorHarness hasMore />);
    expect(screen.getByRole('status')).toHaveTextContent('Page 1');
  });
});

describe('useCursorPage + ListPagination — no-more state', () => {
  it('renders nothing on page 1 when there is no next page', () => {
    render(<CursorHarness hasMore={false} />);

    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Page /)).not.toBeInTheDocument();
  });

  it('keeps the row visible with Next disabled once the last page is reached', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CursorHarness hasMore />);

    await user.click(next());
    // The freshly fetched page 2 turns out to be the last one.
    rerender(<CursorHarness hasMore={false} />);

    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(previous()).toBeEnabled();
  });

  it('holds the guard in the hook, not only in the disabled attribute', async () => {
    const user = userEvent.setup();
    // Undisabled triggers, so the hook's own guards are what stop the move.
    function UnguardedHarness({ hasMore }: { hasMore: boolean }) {
      const pager = useCursorPage(hasMore, { onPageChange });
      return (
        <div>
          <span data-testid="page">Page {pager.currentPage}</span>
          <button type="button" onClick={pager.goToPreviousPage}>
            Raw previous
          </button>
          <button type="button" onClick={pager.goToNextPage}>
            Raw next
          </button>
        </div>
      );
    }

    render(<UnguardedHarness hasMore={false} />);

    await user.click(screen.getByRole('button', { name: 'Raw next' }));
    await user.click(screen.getByRole('button', { name: 'Raw previous' }));

    expect(screen.getByTestId('page')).toHaveTextContent('Page 1');
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

describe('useCursorPage + ListPagination — busy', () => {
  it('disables both controls while a page is in flight without hiding the row', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CursorHarness hasMore />);

    await user.click(next());
    rerender(<CursorHarness hasMore busy />);

    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
  });
});

describe('useCursorPage — reset and onPageChange', () => {
  it('returns to page 1 when the query inputs change', async () => {
    const user = userEvent.setup();
    render(<CursorHarness hasMore withReset />);

    await user.click(next());
    await user.click(next());
    expect(screen.getByText('Page 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New filter' }));
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
  });

  it('fires once per real page change and never for a no-op', async () => {
    const user = userEvent.setup();
    render(<CursorHarness hasMore withCallback withReset />);

    // Already on page 1 — reset changes nothing.
    await user.click(screen.getByRole('button', { name: 'New filter' }));
    expect(onPageChange).not.toHaveBeenCalled();

    await user.click(next());
    await user.click(previous());
    expect(onPageChange).toHaveBeenCalledTimes(2);

    await user.click(next());
    await user.click(screen.getByRole('button', { name: 'New filter' }));
    expect(onPageChange).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// Shared control surface — one component, so these hold for both flavors.
// ---------------------------------------------------------------------------

describe('ListPagination — shared control surface', () => {
  const state = {
    currentPage: 2,
    totalPages: 5,
    canPreviousPage: true,
    canNextPage: true,
    goToPreviousPage: () => {},
    goToNextPage: () => {},
  };

  it('merges a consumer className rather than replacing the component classes', () => {
    const { container } = render(
      <ListPagination pagination={state} className="border-t pt-4" />,
    );
    const row = container.firstElementChild;
    expect(row).toHaveClass('border-t');
    expect(row).toHaveClass('pt-4');
    // The component's own layout classes are still there (merged, not replaced).
    expect(row?.className).toContain('justify-between');
    expect(row?.className).toContain('items-center');
  });

  it('renders the outline button variant in both flavors', () => {
    const { rerender } = render(<ListPagination pagination={state} />);
    expect(previous().className).toContain('border-border');

    rerender(
      <ListPagination
        pagination={{ ...state, totalPages: undefined, canNextPage: true }}
      />,
    );
    expect(next().className).toContain('border-border');
  });

  it('gives both controls a 44px touch target', () => {
    render(<ListPagination pagination={state} />);
    expect(previous().className).toContain('h-11');
    expect(next().className).toContain('min-w-11');
  });
});
