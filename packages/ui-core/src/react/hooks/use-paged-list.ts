"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * The control state a paginated list exposes to its paginator UI, rendered by
 * the ONE `ListPagination` component. Nothing else builds
 * Previous / counter / Next controls.
 *
 * `totalPages` is the flavor discriminant, and the ONLY difference between the
 * two flavors:
 *
 * - **Known total** (client-side slice pagination — {@link usePagedList}):
 *   `totalPages` is a number and the counter reads `"2 of 5"`.
 * - **Unknown total** (server/cursor pagination — `useCursorPage`, or a
 *   caller's own query hook): `totalPages` is omitted and the counter reads
 *   `"Page 2"`.
 *
 * Both flavors share one visibility rule, one disabled-edge rule, one live
 * region, and one set of classes because they share one component (ENG-002,
 * FRONTEND-001).
 */
export interface ListPaginationState {
  /** 1-based page currently on screen. */
  currentPage: number;
  /**
   * Total page count when it is knowable — at least 1, even for an empty list
   * (an empty list is one empty page). Omitted for cursor/`hasMore` pagination,
   * where the total is unknown until the last page is reached.
   */
  totalPages?: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}

export interface PagedList<T> extends ListPaginationState {
  /** Always known for a slice-paginated list. */
  totalPages: number;
  /** The slice of `items` belonging to `currentPage`. */
  pageItems: T[];
}

export interface UsePagedListOptions {
  /**
   * Called after the page actually changed. Surfaces that keep a per-page
   * selection (an open detail row) clear it here — the old selection is not on
   * the new page.
   */
  onPageChange?: () => void;
}

/**
 * The single owner of client-side slice pagination: local page state, the page
 * math, and the current slice over an ALREADY-FETCHED list.
 *
 * Page size is the caller's — every surface passes its own page-size constant
 * (ENG-005), never a literal. Ordering and filtering stay with the caller: pass
 * the list already sorted and filtered.
 *
 * Not for server-paged lists — a cursor/`hasMore` feed pages through the
 * caller's data layer, not through a slice; use `useCursorPage` (or the query
 * hook's own page state) with the same `ListPagination` control.
 */
export function usePagedList<T>(
  items: readonly T[],
  pageSize: number,
  options: UsePagedListOptions = {},
): PagedList<T> {
  const { onPageChange } = options;
  const [requestedPage, setRequestedPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // The list can shrink under a page that is already open (an item is deleted,
  // a filter narrows). Clamping keeps the paginator on a real page instead of
  // rendering an empty slice under an out-of-range "4 of 2".
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, currentPage, pageSize]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage <= 1) return;
    setRequestedPage(currentPage - 1);
    onPageChange?.();
  }, [currentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (currentPage >= totalPages) return;
    setRequestedPage(currentPage + 1);
    onPageChange?.();
  }, [currentPage, totalPages, onPageChange]);

  return {
    currentPage,
    totalPages,
    pageItems,
    canPreviousPage: currentPage > 1,
    canNextPage: currentPage < totalPages,
    goToPreviousPage,
    goToNextPage,
  };
}
