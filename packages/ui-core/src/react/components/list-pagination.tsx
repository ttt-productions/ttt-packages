'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button.js';
import { cn } from '../../lib/utils.js';
import type { ListPaginationState } from '../hooks/use-paged-list.js';

export interface ListPaginationProps {
  pagination: ListPaginationState;
  busy?: boolean;
  className?: string;
}

export function ListPagination({ pagination, busy = false, className }: ListPaginationProps) {
  const { currentPage, totalPages, canPreviousPage, canNextPage, goToPreviousPage, goToNextPage } =
    pagination;

  const [clicked, setClicked] = useState<'previous' | 'next' | null>(null);
  const [wasBusy, setWasBusy] = useState(busy);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (!busy) setClicked(null);
  }
  const previousPending = busy && clicked === 'previous';
  const nextPending = busy && clicked === 'next';
  const previousUnavailable = busy || !canPreviousPage;
  const nextUnavailable = busy || !canNextPage;

  if (!canPreviousPage && !canNextPage) return null;

  return (
    <div className={cn('flex w-full items-center justify-between gap-4 mt-4', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (previousUnavailable) return;
          setClicked('previous');
          goToPreviousPage();
        }}
        aria-disabled={previousUnavailable || undefined}
        pending={previousPending}
        icon={<ChevronLeft className="icon-xs" />}
        className="h-11 min-w-11"
      >
        Previous
      </Button>
      <span className="text-counter" role="status">
        {totalPages === undefined ? `Page ${currentPage}` : `${currentPage} of ${totalPages}`}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (nextUnavailable) return;
          setClicked('next');
          goToNextPage();
        }}
        aria-disabled={nextUnavailable || undefined}
        pending={nextPending}
        className="h-11 min-w-11"
      >
        Next
        {nextPending ? null : <ChevronRight className="icon-xs" />}
      </Button>
    </div>
  );
}
