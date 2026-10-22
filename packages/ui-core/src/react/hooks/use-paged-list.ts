'use client';

import { useCallback, useMemo, useState } from 'react';

export interface ListPaginationState {
  currentPage: number;
  totalPages?: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}

export interface PagedList<T> extends ListPaginationState {
  totalPages: number;
  pageItems: T[];
}

export interface UsePagedListOptions {
  onPageChange?: () => void;
}

export function usePagedList<T>(
  items: readonly T[],
  pageSize: number,
  options: UsePagedListOptions = {},
): PagedList<T> {
  const { onPageChange } = options;
  const [requestedPage, setRequestedPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
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
