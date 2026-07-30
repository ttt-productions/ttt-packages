"use client";

import { useCallback, useState } from "react";
import type { ListPaginationState } from "./use-paged-list.js";

/**
 * Render-time page state for a cursor feed, shaped as {@link ListPaginationState}
 * so it drops straight into the ONE `ListPagination` control. Produced by
 * {@link CursorPager.paginationFor} once the query for `currentPage` has
 * answered with its `hasMore`.
 */
export interface CursorPage extends ListPaginationState {
  /** Never known for cursor pagination — the counter reads "Page N". */
  totalPages?: undefined;
}

export interface UseCursorPageOptions {
  /** Called after the page actually changed. Same contract as `usePagedList`. */
  onPageChange?: () => void;
  /**
   * A snapshot of the query inputs the page number belongs to — a tag, a filter,
   * a sort. When it changes, the page is 1 again **in the same render**, so the
   * query never fires for "page 4" of inputs whose page 4 may not exist.
   *
   * Use this when the input change arrives as a prop (there is no event handler
   * of yours to hang the reset on); use {@link CursorPager.reset} when your own
   * handler already owns the change. Compose several inputs into one string
   * (`` `${type}|${projectId ?? ""}` ``) — the type is deliberately narrowed to
   * primitives so a fresh object literal cannot pin the list to page 1 forever.
   */
  resetKey?: string | number | boolean | null;
}

/**
 * What {@link useCursorPage} owns: the page number, the guarded step controls,
 * and the return-to-page-1 control.
 */
export interface CursorPager {
  /** 1-based page to feed into the paged query. */
  currentPage: number;
  /**
   * Return to page 1 without walking back. Call it from the handler that changes
   * the query's inputs (a new filter, a new tag, a new sort) — page 4 of the old
   * result set is not page 4 of the new one. A no-op on page 1, so it never
   * fires `onPageChange` for nothing.
   */
  reset: () => void;
  /**
   * Bind the query's answer to the controls: pass the `hasMore` that came back
   * for {@link currentPage} and render the result as
   * `<ListPagination pagination={…} />`. `hasMore` binds HERE, after the query,
   * because that is the only moment it exists — a cursor query needs
   * `currentPage` as its input, so `hasMore` cannot be an argument to the hook
   * that produces `currentPage`.
   */
  paginationFor: (hasMore: boolean) => CursorPage;
}

/**
 * Page state for a server-paged (cursor / `hasMore`) list: the 1-based page
 * number, the guarded step controls, and the reset — the pieces each
 * server-paged surface was otherwise re-declaring as a local `useState(1)` plus
 * its own clamped increment/decrement and its own "reset when the filter
 * changed" adjustment (ENG-002, ENG-003).
 *
 * The data stays the caller's, and the two halves bind at different moments:
 *
 * ```tsx
 * const pager = useCursorPage({ resetKey: tag });
 * const { data, isFetching } = useThingsByTag(tag, pager.currentPage);
 * …
 * <ListPagination pagination={pager.paginationFor(data?.hasMore ?? false)} busy={isFetching} />
 * ```
 *
 * The guards live in here, not at the call site: a step that cannot move the
 * page changes nothing and does not fire `onPageChange`.
 *
 * A surface whose data hook ALREADY owns its page state (it returns
 * `page`/`hasNextPage`/`nextPage`/`prevPage` itself) does not need this hook —
 * it maps those fields onto {@link ListPaginationState} directly. The hook
 * exists for the surfaces that would otherwise hand-roll the state.
 */
export function useCursorPage(options: UseCursorPageOptions = {}): CursorPager {
  const { onPageChange, resetKey } = options;

  // The stored page is only meaningful for the inputs it was reached under, so
  // the key it belongs to is stored WITH it.
  const [pageState, setPageState] = useState<{
    page: number;
    key: UseCursorPageOptions["resetKey"];
  }>({ page: 1, key: resetKey });

  // `Object.is`, the same comparison React uses for state and deps: a `NaN` key
  // must compare equal to itself, or the adjustment below would re-fire forever.
  const keyMatches = Object.is(pageState.key, resetKey);

  // React's "adjusting state when a prop changes": a new key retires the stored
  // page, because page 4 of the old result set is not page 4 of the new one.
  // Retiring it (rather than only ignoring it) is what makes going BACK to
  // earlier inputs start at page 1 too, instead of reviving a dead page.
  if (!keyMatches) {
    setPageState({ page: 1, key: resetKey });
  }
  // Derived as well as adjusted, so even the render that triggers the adjustment
  // already reports page 1 — the caller's query is never asked for a page of the
  // new inputs that the user never navigated to.
  const currentPage = keyMatches ? pageState.page : 1;

  const goToPreviousPage = useCallback(() => {
    if (currentPage <= 1) return;
    setPageState({ page: currentPage - 1, key: resetKey });
    onPageChange?.();
  }, [currentPage, resetKey, onPageChange]);

  const reset = useCallback(() => {
    if (currentPage === 1) return;
    setPageState({ page: 1, key: resetKey });
    onPageChange?.();
  }, [currentPage, resetKey, onPageChange]);

  // Memoized on the page state itself, so a consumer may hold it in a dep array
  // and it changes only when the page (or the callback/inputs) actually change.
  const paginationFor = useCallback(
    (hasMore: boolean): CursorPage => ({
      currentPage,
      canPreviousPage: currentPage > 1,
      canNextPage: hasMore,
      goToPreviousPage,
      goToNextPage: () => {
        if (!hasMore) return;
        setPageState({ page: currentPage + 1, key: resetKey });
        onPageChange?.();
      },
    }),
    [currentPage, resetKey, onPageChange, goToPreviousPage],
  );

  return { currentPage, reset, paginationFor };
}
