import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** Invalidate everything that matches a key prefix. */
export async function invalidateByPrefix(client: QueryClient, prefix: QueryKey) {
  return client.invalidateQueries({ queryKey: prefix, exact: false });
}

/** Remove everything that matches a key prefix (drops cached data). */
export function removeByPrefix(client: QueryClient, prefix: QueryKey) {
  return client.removeQueries({ queryKey: prefix, exact: false });
}

/**
 * Generic cache update helper.
 * Useful for optimistic updates without baking in business logic.
 */
export function updateQueryData<T>(
  client: QueryClient,
  key: QueryKey,
  updater: (prev: T | undefined) => T
) {
  client.setQueryData<T>(key, (prev) => updater(prev));
}
