import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { usePagedList } from '../src/react/hooks/use-paged-list.js';
import { useCursorPage } from '../src/react/hooks/use-cursor-page.js';
import { ListPagination } from '../src/react/components/list-pagination.js';

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

    expect(previous()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).not.toHaveAttribute('aria-disabled');

    await user.click(next());

    expect(previous()).not.toHaveAttribute('aria-disabled');
    expect(next()).toHaveAttribute('aria-disabled', 'true');
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

    rerender(<SliceHarness items={makeItems(4)} pageSize={3} />);

    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-4']);
    expect(next()).toHaveAttribute('aria-disabled', 'true');
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

    await user.click(previous());
    expect(onPageChange).not.toHaveBeenCalled();

    await user.click(next());
    expect(onPageChange).toHaveBeenCalledTimes(1);

    await user.click(next());
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });
});

const QUERY_PAGE_SIZE = 3;

const queryCalls: string[] = [];

function useFakePagedQuery(tag: string, page: number) {
  queryCalls.push(`${tag}:${page}`);
  const total = tag === 'b' ? 2 : 7;
  const start = (page - 1) * QUERY_PAGE_SIZE;
  return {
    items: makeItems(Math.max(0, Math.min(QUERY_PAGE_SIZE, total - start)), start + 1),
    hasMore: start + QUERY_PAGE_SIZE < total,
  };
}

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
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).not.toHaveAttribute('aria-disabled');
  });

  it('walks forward, the query answering with fresh rows and a fresh hasMore', async () => {
    const user = userEvent.setup();
    render(<QueryHarness />);

    await user.click(next());
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-4', 'item-5', 'item-6']);
    expect(previous()).not.toHaveAttribute('aria-disabled');
    expect(next()).not.toHaveAttribute('aria-disabled');

    await user.click(next());
    expect(screen.getByText('Page 3')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-7']);
    expect(next()).toHaveAttribute('aria-disabled', 'true');
    expect(previous()).not.toHaveAttribute('aria-disabled');
  });

  it('walks back to the earlier page', async () => {
    const user = userEvent.setup();
    render(<QueryHarness />);

    await user.click(next());
    await user.click(previous());

    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['item-1', 'item-2', 'item-3']);
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
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
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('useCursorPage — guards live in the hook', () => {
  it('refuses both steps that cannot move, with the buttons undisabled', async () => {
    const user = userEvent.setup();
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

    render(<UnguardedHarness tag="b" />);

    await user.click(screen.getByRole('button', { name: 'Raw next' }));
    await user.click(screen.getByRole('button', { name: 'Raw previous' }));

    expect(screen.getByTestId('page')).toHaveTextContent('Page 1');
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('fires onPageChange once per real page change and never for a no-op', async () => {
    const user = userEvent.setup();
    render(<QueryHarness withCallback />);

    await user.click(previous());
    expect(onPageChange).not.toHaveBeenCalled();

    await user.click(next());
    await user.click(previous());
    expect(onPageChange).toHaveBeenCalledTimes(2);

    await user.click(next());
    await user.click(next());
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

    rerender(<QueryHarness tag="b" />);

    expect(visibleRows()).toEqual(['item-1', 'item-2']);
    expect(screen.queryByText(/Page /)).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Tag A' }));
    expect(visibleRows()).toEqual(['item-1', 'item-2', 'item-3']);
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
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

    await user.click(next());
    const latest = identities[identities.length - 1];
    expect(latest.reset).not.toBe(first.reset);
    expect(latest.paginationFor).not.toBe(first.paginationFor);
  });
});

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
    const { container } = render(<ListPagination pagination={state} className="border-t pt-4" />);
    const row = container.firstElementChild;
    expect(row).toHaveClass('border-t');
    expect(row).toHaveClass('pt-4');
    expect(row?.className).toContain('justify-between');
    expect(row?.className).toContain('items-center');
  });

  it('renders the outline button variant in both flavors', () => {
    const { rerender } = render(<ListPagination pagination={state} />);
    expect(previous().className).toContain('border-border');

    rerender(
      <ListPagination pagination={{ ...state, totalPages: undefined, canNextPage: true }} />,
    );
    expect(next().className).toContain('border-border');
  });

  it('gives both controls a 44px touch target', () => {
    render(<ListPagination pagination={state} />);
    expect(previous().className).toContain('h-11');
    expect(next().className).toContain('min-w-11');
  });
});

describe('ListPagination — the clicked control spins while its page loads', () => {
  const state = {
    currentPage: 2,
    totalPages: 5,
    canPreviousPage: true,
    canNextPage: true,
    goToPreviousPage: () => {},
    goToNextPage: () => {},
  };

  it('spins only the control that started the in-flight page, and clears when busy ends', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ListPagination pagination={state} />);
    await user.click(next());

    rerender(<ListPagination pagination={state} busy />);
    expect(next()).toHaveAttribute('aria-busy', 'true');
    expect(previous()).not.toHaveAttribute('aria-busy');
    expect(previous()).toHaveAttribute('aria-disabled', 'true');

    rerender(<ListPagination pagination={state} />);
    expect(next()).not.toHaveAttribute('aria-busy');
    expect(next()).not.toHaveAttribute('aria-disabled');
  });

  it('keeps focus on the pressed control while its page loads and when it lands on an edge', async () => {
    const user = userEvent.setup();
    const goToNextPage = vi.fn();
    const { rerender } = render(<ListPagination pagination={{ ...state, goToNextPage }} />);
    await user.click(next());
    expect(next()).toHaveFocus();

    rerender(<ListPagination pagination={{ ...state, goToNextPage }} busy />);
    expect(next()).not.toBeDisabled();
    expect(next()).toHaveFocus();
    await user.click(next());
    expect(goToNextPage).toHaveBeenCalledTimes(1);

    rerender(
      <ListPagination
        pagination={{ ...state, currentPage: 5, canNextPage: false, goToNextPage }}
      />,
    );
    expect(next()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).toHaveFocus();
    await user.click(next());
    expect(goToNextPage).toHaveBeenCalledTimes(1);
  });

  it('a busy list with no click behind it (a refetch) disables both controls but spins neither', () => {
    render(<ListPagination pagination={state} busy />);
    expect(previous()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).toHaveAttribute('aria-disabled', 'true');
    expect(previous()).not.toHaveAttribute('aria-busy');
    expect(next()).not.toHaveAttribute('aria-busy');
  });
});
