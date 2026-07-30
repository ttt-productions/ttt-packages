import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
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
  queryCalls.length = 0;
  identities.length = 0;
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
//
// Exercised through the REAL data flow, not a `hasMore` prop: the query takes
// the page number as its INPUT and only then can say whether more pages exist.
// That circularity is the whole reason `hasMore` binds late, via
// `paginationFor(hasMore)` — a `useCursorPage(hasMore)` signature is
// unsatisfiable at a real call site, and these harnesses are what proves it.
// ---------------------------------------------------------------------------

const QUERY_PAGE_SIZE = 3;

/** Every `tag:page` the fake query was asked for, in order. */
const queryCalls: string[] = [];

/**
 * Stand-in for the app's real paged query hooks (`useArchivedPendingMedia(page)`,
 * `useCraftSkillsByTagPaginated(tag, page)`, `useActiveAuditions(page, filter)`):
 * page in, `{ items, hasMore }` out. Tag "a" holds 7 rows (3 pages), tag "b"
 * holds 2 (a single page), so an input change also flips `hasMore`.
 */
function useFakePagedQuery(tag: string, page: number) {
  queryCalls.push(`${tag}:${page}`);
  const total = tag === 'b' ? 2 : 7;
  const start = (page - 1) * QUERY_PAGE_SIZE;
  return {
    items: makeItems(Math.max(0, Math.min(QUERY_PAGE_SIZE, total - start)), start + 1),
    hasMore: start + QUERY_PAGE_SIZE < total,
  };
}

/**
 * The declarative adoption: the input change arrives as a PROP, so the page
 * resets through `resetKey` (mirrors `ActiveAuditionsTable`'s filter props).
 */
function QueryHarness({
  tag = 'a',
  busy = false,
  withCallback = false,
}: {
  tag?: string;
  busy?: boolean;
  withCallback?: boolean;
}) {
  const pager = useCursorPage({ resetKey: tag, ...(withCallback ? { onPageChange } : {}) });
  const { items, hasMore } = useFakePagedQuery(tag, pager.currentPage);
  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item} data-testid="row">
            {item}
          </li>
        ))}
      </ul>
      <ListPagination pagination={pager.paginationFor(hasMore)} busy={busy} />
    </div>
  );
}

/**
 * The imperative adoption: the component owns the input, so its own change
 * handler calls `reset()` (mirrors `CraftSkillBrowse`'s tag select).
 */
function HandlerHarness({ withCallback = false }: { withCallback?: boolean }) {
  const [tag, setTag] = useState('a');
  const pager = useCursorPage(withCallback ? { onPageChange } : {});
  const { items, hasMore } = useFakePagedQuery(tag, pager.currentPage);
  const changeTag = (nextTag: string) => {
    setTag(nextTag);
    pager.reset();
  };
  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item} data-testid="row">
            {item}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => changeTag('b')}>
        Tag B
      </button>
      <button type="button" onClick={() => changeTag('a')}>
        Tag A
      </button>
      <ListPagination pagination={pager.paginationFor(hasMore)} />
    </div>
  );
}

describe('useCursorPage + ListPagination — the real query flow', () => {
  it('feeds the page into the query and takes hasMore back out of it', () => {
    render(<QueryHarness />);

    expect(queryCalls).toContain('a:1');
    expect(visibleRows()).toEqual(['item-1', 'item-2', 'item-3']);
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
  });

  it('walks forward, the query answering with fresh rows and a fresh hasMore', async () => {
    const user = userEvent.setup();
    render(<QueryHarness />);

    await user.click(next());
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-4', 'item-5', 'item-6']);
    expect(previous()).toBeEnabled();
    expect(next()).toBeEnabled();

    // The query says page 3 is the last one — Next disables from the DATA, which
    // only exists after the page it describes has been requested.
    await user.click(next());
    expect(screen.getByText('Page 3')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-7']);
    expect(next()).toBeDisabled();
    expect(previous()).toBeEnabled();
  });

  it('walks back to the earlier page', async () => {
    const user = userEvent.setup();
    render(<QueryHarness />);

    await user.click(next());
    await user.click(previous());

    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-1', 'item-2', 'item-3']);
    expect(previous()).toBeDisabled();
  });

  it('renders no controls at all when the first page is the only page', () => {
    render(<QueryHarness tag="b" />);

    expect(visibleRows()).toEqual(['item-1', 'item-2']);
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Page /)).not.toBeInTheDocument();
  });

  it('announces the page counter as a live status region', () => {
    render(<QueryHarness />);
    expect(screen.getByRole('status')).toHaveTextContent('Page 1');
  });

  it('disables both controls while a page is in flight without hiding the row', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QueryHarness />);

    await user.click(next());
    rerender(<QueryHarness busy />);

    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
  });
});

describe('useCursorPage — guards live in the hook', () => {
  it('refuses both steps that cannot move, with the buttons undisabled', async () => {
    const user = userEvent.setup();
    // Raw triggers with no `disabled` attribute, so only the hook's own guards
    // can stop the move — the control must not be the thing holding the line.
    function UnguardedHarness({ tag }: { tag: string }) {
      const pager = useCursorPage({ onPageChange });
      const { hasMore } = useFakePagedQuery(tag, pager.currentPage);
      const pagination = pager.paginationFor(hasMore);
      return (
        <div>
          <span data-testid="page">Page {pager.currentPage}</span>
          <button type="button" onClick={pagination.goToPreviousPage}>
            Raw previous
          </button>
          <button type="button" onClick={pagination.goToNextPage}>
            Raw next
          </button>
        </div>
      );
    }

    // Tag "b" is a single page: neither direction is available on page 1.
    render(<UnguardedHarness tag="b" />);

    await user.click(screen.getByRole('button', { name: 'Raw next' }));
    await user.click(screen.getByRole('button', { name: 'Raw previous' }));

    expect(screen.getByTestId('page')).toHaveTextContent('Page 1');
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('fires onPageChange once per real page change and never for a no-op', async () => {
    const user = userEvent.setup();
    render(<QueryHarness withCallback />);

    await user.click(previous()); // disabled on page 1
    expect(onPageChange).not.toHaveBeenCalled();

    await user.click(next());
    await user.click(previous());
    expect(onPageChange).toHaveBeenCalledTimes(2);

    await user.click(next());
    await user.click(next()); // page 3 is the last page
    await user.click(next());
    expect(onPageChange).toHaveBeenCalledTimes(4);
  });
});

describe('useCursorPage — returning to page 1 when the query inputs change', () => {
  it('resets declaratively via resetKey without ever querying the old page under the new inputs', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QueryHarness tag="a" />);

    await user.click(next());
    await user.click(next());
    expect(screen.getByText('Page 3')).toBeInTheDocument();

    // A new tag arrives as a prop while page 3 is open.
    rerender(<QueryHarness tag="b" />);

    expect(visibleRows()).toEqual(['item-1', 'item-2']);
    // Single page under the new tag, so the whole row is gone again.
    expect(screen.queryByText(/Page /)).not.toBeInTheDocument();
    // The page-1 reset happened in the SAME render: the query was never asked
    // for page 3 (or 2) of the new tag.
    expect(queryCalls).toContain('b:1');
    expect(queryCalls).not.toContain('b:3');
    expect(queryCalls).not.toContain('b:2');
  });

  it('does not fire onPageChange for a resetKey change (no callbacks during render)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QueryHarness tag="a" withCallback />);

    await user.click(next());
    expect(onPageChange).toHaveBeenCalledTimes(1);

    rerender(<QueryHarness tag="b" withCallback />);
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it('resets imperatively from the consumer own change handler', async () => {
    const user = userEvent.setup();
    render(<HandlerHarness />);

    await user.click(next());
    expect(screen.getByText('Page 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tag B' }));
    expect(visibleRows()).toEqual(['item-1', 'item-2']);
    expect(queryCalls).not.toContain('b:2');

    // Back to the multi-page tag: page 1 again, both rows and controls restored.
    await user.click(screen.getByRole('button', { name: 'Tag A' }));
    expect(visibleRows()).toEqual(['item-1', 'item-2', 'item-3']);
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
  });

  it('treats reset() on page 1 as a no-op, so onPageChange does not fire', async () => {
    const user = userEvent.setup();
    render(<HandlerHarness withCallback />);

    await user.click(screen.getByRole('button', { name: 'Tag B' }));
    expect(onPageChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Tag A' }));
    await user.click(next());
    expect(onPageChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Tag B' }));
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });
});

/** Callback identities seen on each render of `StabilityHarness`. */
const identities: Array<{ reset: () => void; paginationFor: (hasMore: boolean) => unknown }> = [];

describe('useCursorPage — referential stability', () => {
  function StabilityHarness({ nonce }: { nonce: number }) {
    const pager = useCursorPage();
    const { hasMore } = useFakePagedQuery('a', pager.currentPage);
    identities.push({ reset: pager.reset, paginationFor: pager.paginationFor });
    return (
      <div>
        <span data-testid="nonce">{nonce}</span>
        <ListPagination pagination={pager.paginationFor(hasMore)} />
      </div>
    );
  }

  it('keeps reset and paginationFor stable across a re-render that does not change the page', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StabilityHarness nonce={1} />);

    rerender(<StabilityHarness nonce={2} />);
    const [first, second] = identities;
    expect(second.reset).toBe(first.reset);
    expect(second.paginationFor).toBe(first.paginationFor);

    // A real page change is the one thing that must produce new identities —
    // that is what carries the new page into a consumer dep array.
    await user.click(next());
    const latest = identities[identities.length - 1];
    expect(latest.reset).not.toBe(first.reset);
    expect(latest.paginationFor).not.toBe(first.paginationFor);
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
