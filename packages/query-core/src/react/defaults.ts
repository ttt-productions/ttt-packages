import type { DefaultOptions, QueryClientConfig } from '@tanstack/react-query';

export const defaultQueryOptions: DefaultOptions = {
  queries: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,

    staleTime: 30_000,
    gcTime: 5 * 60_000,

    retry: (failureCount) => failureCount < 2,
  },
  mutations: {
    retry: 0,
  },
};

export const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: defaultQueryOptions,
};
