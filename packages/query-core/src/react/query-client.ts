import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';
import { defaultQueryClientConfig } from './defaults.js';

export type CreateQueryClientOptions = QueryClientConfig;

export function createQueryClient(overrides: CreateQueryClientOptions = {}) {
  return new QueryClient({
    ...defaultQueryClientConfig,
    ...overrides,
    defaultOptions: {
      ...defaultQueryClientConfig.defaultOptions,
      ...overrides.defaultOptions,
      queries: {
        ...defaultQueryClientConfig.defaultOptions?.queries,
        ...overrides.defaultOptions?.queries,
      },
      mutations: {
        ...defaultQueryClientConfig.defaultOptions?.mutations,
        ...overrides.defaultOptions?.mutations,
      },
    },
  });
}
