// What the notification read hooks return beside their page, for tests that mock them: the
// stand-in's own failure, loading, and fetching fields become the held retry state (query-core
// `useReadRetryState`). A stand-in that supplies its own `retryState` keeps it — the mid-retry shape
// of a failed first page, where the page reads as loading with no error while the held state still
// carries the failure.

type RetryState = { error: unknown; isRetrying: boolean; isLoading: boolean };

export const withRetryState = <
  T extends {
    error?: unknown;
    isError?: boolean;
    isFetching?: unknown;
    isLoading?: unknown;
    retryState?: RetryState;
  },
>(
  read: T,
) => {
  const error = read.error ?? (read.isError ? new Error('read failed') : null);
  return {
    ...read,
    retryState: read.retryState ?? {
      error,
      isRetrying: error !== null && !!read.isFetching,
      isLoading: error === null && !!read.isLoading,
    },
  };
};
