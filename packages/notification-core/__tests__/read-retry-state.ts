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
