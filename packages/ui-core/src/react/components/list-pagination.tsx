"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button.js";
import { cn } from "../../lib/utils.js";
import type { ListPaginationState } from "../hooks/use-paged-list.js";

export interface ListPaginationProps {
  /**
   * Page state from `usePagedList` (known total), `useCursorPage` (unknown
   * total), or any caller-owned state of the same shape.
   */
  pagination: ListPaginationState;
  /**
   * Disables BOTH controls while the next page is in flight, without hiding the
   * row. Server-paged surfaces pass their query's `isFetching`; a slice-paged
   * list has nothing to wait for and omits it.
   */
  busy?: boolean;
  /** Optional extra classes. Merged with the component's own classes. */
  className?: string;
}

/**
 * The ONE Previous / counter / Next control for paginated lists, in both
 * flavors. Pair it with the hook that owns the page state (`usePagedList` for a
 * client-side slice, `useCursorPage` — or the caller's own query state — for a
 * cursor feed); this component owns only the controls, so every paginated list
 * reads and behaves the same (ENG-002, FRONTEND-001).
 *
 * The counter follows the flavor: a known `totalPages` reads "2 of 5", an
 * omitted one reads "Page 2". Everything else is identical in both flavors —
 * which is exactly why there is one component and not two.
 *
 * It renders NOTHING when neither direction is available, so no call site
 * repeats a `totalPages > 1` / `page > 1 || hasMore` guard. Edge state is real
 * `disabled` on the buttons (announced, and unclickable), and the counter is a
 * `status` live region so a page change is announced to screen readers.
 */
export function ListPagination({ pagination, busy = false, className }: ListPaginationProps) {
  const { currentPage, totalPages, canPreviousPage, canNextPage, goToPreviousPage, goToNextPage } =
    pagination;

  // One visibility rule for both flavors. For a known total this is exactly
  // `totalPages > 1`: page state is clamped into `1..totalPages`, so a
  // single-page list has no reachable neighbour in either direction, and a
  // multi-page list always has one. For a cursor feed it is the hand-rolled
  // `page > 1 || hasMore`. `busy` deliberately does not hide the row — the
  // controls grey out in place instead of vanishing mid-fetch.
  if (!canPreviousPage && !canNextPage) return null;

  return (
    <div className={cn("flex w-full items-center justify-between gap-4 mt-4", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={goToPreviousPage}
        disabled={busy || !canPreviousPage}
        className="h-11 min-w-11"
      >
        <ChevronLeft className="icon-xs mr-1" />
        Previous
      </Button>
      <span className="text-counter" role="status">
        {totalPages === undefined ? `Page ${currentPage}` : `${currentPage} of ${totalPages}`}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={goToNextPage}
        disabled={busy || !canNextPage}
        className="h-11 min-w-11"
      >
        Next
        <ChevronRight className="icon-xs ml-1" />
      </Button>
    </div>
  );
}
