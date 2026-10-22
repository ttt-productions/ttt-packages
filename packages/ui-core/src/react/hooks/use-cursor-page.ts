'use client';

import { useCallback, useState } from 'react';
import type { ListPaginationState } from './use-paged-list.js';

export interface CursorPage extends ListPaginationState {
  totalPages?: undefined;
}

export interface UseCursorPageOptions {
  onPageChange?: () => void;
  resetKey?: string | number | boolean | null;
}

export interface CursorPager {
  currentPage: number;
  reset: () => void;
  paginationFor: (hasMore: boolean) => CursorPage;
}

export function useCursorPage(options: UseCursorPageOptions = {}): CursorPager {
  const { onPageChange, resetKey } = options;

  const [pageState, setPageState] = useState<{
    page: number;
    key: UseCursorPageOptions['resetKey'];
  }>({ page: 1, key: resetKey });

  // `Object.is`, as React compares: a `NaN` key must equal itself, or the adjustment below re-fires forever.
  const keyMatches = Object.is(pageState.key, resetKey);

  if (!keyMatches) {
    setPageState({ page: 1, key: resetKey });
  }
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
