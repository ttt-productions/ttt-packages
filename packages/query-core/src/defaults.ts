import type { DefaultOptions, QueryClientConfig } from '@tanstack/react-query';

/**
 * Small, conservative defaults intended to work well across apps.
 * Apps can override via `createTTTQueryClient({ defaultOptions: ... })`.
 */
export const tttDefaultOptions: DefaultOptions = {
  queries: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,

    staleTime: 30_000, // 30s
    gcTime: 5 * 60_000, // 5m

    retry: (failureCount) => failureCount < 2,
  },
  mutations: {
    retry: 0,
  },
};

export const tttQueryClientConfig: QueryClientConfig = {
  defaultOptions: tttDefaultOptions,
};
