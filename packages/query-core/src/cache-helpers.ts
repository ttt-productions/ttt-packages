import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { PaginatedPage } from './firestore/types.js';

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

/** The cache key of page `page` of a `useFirestorePaginated` list keyed `queryKey`. */
export function paginatedPageKey(queryKey: QueryKey, page: number): QueryKey {
  return [...queryKey, 'page', page];
}

function isPaginatedPage(value: unknown): value is PaginatedPage<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items) &&
    typeof (value as { hasMore?: unknown }).hasMore === 'boolean'
  );
}

function isPageKey(baseKey: QueryKey, key: QueryKey): boolean {
  return key.length === baseKey.length + 2 && key[baseKey.length] === 'page';
}

/**
 * Patch rows in place across every cached page of a `useFirestorePaginated` list
 * (`queryKey` is the base key the hook was given). Return the same row to leave it
 * unchanged; a page with no changed row keeps its identity. Cursors and has-more are
 * untouched, so paging stays aligned with the server.
 */
export function mapPaginatedItems<T>(
  client: QueryClient,
  queryKey: QueryKey,
  mapItem: (item: T) => T,
): void {
  for (const [key, value] of client.getQueriesData<PaginatedPage<T>>({ queryKey })) {
    if (!isPageKey(queryKey, key) || !isPaginatedPage(value)) continue;
    let changed = false;
    const items = value.items.map((item) => {
      const next = mapItem(item as T);
      if (next !== item) changed = true;
      return next;
    });
    if (changed) client.setQueryData<PaginatedPage<T>>(key, { ...value, items });
  }
}

/**
 * Put a just-created row at the top of page 1 of a `useFirestorePaginated` list, only
 * when page 1 is cached. Use it only for a list ordered newest-first. Page 1 keeps its
 * cursor, so it shows one extra row and page 2 keeps its place until page 1 is next read;
 * that read moves page 1's cursor, and the hook then re-reads page 2 from the new cursor
 * before showing it.
 */
export function prependToFirstPaginatedPage<T>(
  client: QueryClient,
  queryKey: QueryKey,
  item: T,
): void {
  const key = paginatedPageKey(queryKey, 1);
  const value = client.getQueryData<PaginatedPage<T>>(key);
  if (!isPaginatedPage(value)) return;
  client.setQueryData<PaginatedPage<T>>(key, { ...value, items: [item, ...value.items] });
}
