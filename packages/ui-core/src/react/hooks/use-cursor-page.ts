"use client";

import { useCallback, useState } from "react";
import type { ListPaginationState } from "./use-paged-list.js";

export interface CursorPage extends ListPaginationState {
  /** Never known for cursor pagination — the counter reads "Page N". */
  totalPages?: undefined;
  /**
   * Return to page 1 without walking back. Call it whenever the underlying
   * query's inputs change (a new filter, a new tag, a new sort) — page 4 of the
   * old result set is not page 4 of the new one.
   */
  reset: () => void;
}

export interface UseCursorPageOptions {
  /** Called after the page actually changed. Same contract as `usePagedList`. */
  onPageChange?: () => void;
}

/**
 * Page state for a server-paged (cursor / `hasMore`) list: the 1-based page
 * number plus guarded step controls, shaped as {@link ListPaginationState} so it
 * drops straight into the ONE `ListPagination` control.
 *
 * The caller owns the data: it feeds `hasMore` from its query and passes
 * `currentPage` back into that query. This hook owns only the page number — the
 * piece each server-paged surface was otherwise re-declaring as a local
 * `useState(1)` plus its own clamped increment/decrement (ENG-002, ENG-003).
 *
 * A surface whose data hook ALREADY owns its page state (it returns
 * `page`/`hasNextPage`/`nextPage`/`prevPage` itself) does not need this hook —
 * it maps those fields onto `ListPaginationState` directly. The hook exists for
 * the surfaces that would otherwise hand-roll the state.
 */
export function useCursorPage(
  hasMore: boolean,
  options: UseCursorPageOptions = {},
): CursorPage {
  const { onPageChange } = options;
  const [currentPage, setCurrentPage] = useState(1);

  // Guards live here, not at the call site: a click that cannot move the page
  // must not fire `onPageChange` and must not push the page past the data.
  const goToPreviousPage = useCallback(() => {
    if (currentPage <= 1) return;
    setCurrentPage(currentPage - 1);
    onPageChange?.();
  }, [currentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (!hasMore) return;
    setCurrentPage(currentPage + 1);
    onPageChange?.();
  }, [currentPage, hasMore, onPageChange]);

  const reset = useCallback(() => {
    if (currentPage === 1) return;
    setCurrentPage(1);
    onPageChange?.();
  }, [currentPage, onPageChange]);

  return {
    currentPage,
    canPreviousPage: currentPage > 1,
    canNextPage: hasMore,
    goToPreviousPage,
    goToNextPage,
    reset,
  };
}
