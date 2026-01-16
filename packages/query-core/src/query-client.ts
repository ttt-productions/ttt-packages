import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';
import { tttQueryClientConfig } from './defaults';

export type CreateTTTQueryClientOptions = QueryClientConfig;

/**
 * Factory so every app uses the same baseline behavior.
 * Pass overrides to adjust defaults without forking.
 */
export function createTTTQueryClient(overrides: CreateTTTQueryClientOptions = {}) {
  return new QueryClient({
    ...tttQueryClientConfig,
    ...overrides,
    defaultOptions: {
      ...tttQueryClientConfig.defaultOptions,
      ...overrides.defaultOptions,
      queries: {
        ...tttQueryClientConfig.defaultOptions?.queries,
        ...overrides.defaultOptions?.queries,
      },
      mutations: {
        ...tttQueryClientConfig.defaultOptions?.mutations,
        ...overrides.defaultOptions?.mutations,
      },
    },
  });
}
