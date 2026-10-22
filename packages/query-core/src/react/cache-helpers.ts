import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { PaginatedPage } from './firestore/types.js';

export async function invalidateByPrefix(client: QueryClient, prefix: QueryKey) {
  return client.invalidateQueries({ queryKey: prefix, exact: false });
}

export function removeByPrefix(client: QueryClient, prefix: QueryKey) {
  return client.removeQueries({ queryKey: prefix, exact: false });
}

export function updateQueryData<T>(
  client: QueryClient,
  key: QueryKey,
  updater: (prev: T | undefined) => T,
) {
  client.setQueryData<T>(key, (prev) => updater(prev));
}

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

export interface PagedRows<P, T> {
  rowsOf: (page: P) => readonly T[];
  withRows: (page: P, rows: T[]) => P;
  isRow: (candidate: T) => boolean;
  sortsBefore: (a: T, b: T) => boolean;
  hasMoreAfter: (page: P) => boolean;
}

export function placeRowInPages<P, T, TParam = unknown>(
  data: InfiniteData<P, TParam> | undefined,
  row: T,
  belongs: boolean,
  how: PagedRows<P, T>,
): InfiniteData<P, TParam> | undefined {
  if (!data || data.pages.length === 0) return data;
  let changed = false;
  const rows = data.pages.map((page) => {
    const kept = how.rowsOf(page).filter((candidate) => !how.isRow(candidate));
    if (kept.length !== how.rowsOf(page).length) changed = true;
    return kept;
  });
  if (belongs) {
    let placed = false;
    for (const pageRows of rows) {
      const index = pageRows.findIndex((candidate) => how.sortsBefore(row, candidate));
      if (index !== -1) {
        pageRows.splice(index, 0, row);
        placed = true;
        break;
      }
    }
    const lastIndex = data.pages.length - 1;
    if (!placed && !how.hasMoreAfter(data.pages[lastIndex])) {
      rows[lastIndex].push(row);
      placed = true;
    }
    changed = changed || placed;
  }
  if (!changed) return data;
  return { ...data, pages: data.pages.map((page, i) => how.withRows(page, rows[i])) };
}
