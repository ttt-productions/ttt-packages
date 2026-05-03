import type { InfinitePage, WithId } from './types.js';

/**
 * Flatten infinite query pages into a single array of items.
 *
 * @example
 * ```tsx
 * const { data } = useFirestoreInfinite<Post>({ ... });
 * const posts = flattenInfiniteData(data);
 * ```
 */
export function flattenInfiniteData<T>(
  data: { pages: InfinitePage<T>[] } | undefined
): WithId<T>[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

/**
 * Get total count of items across all loaded pages.
 */
export function getInfiniteDataCount<T>(
  data: { pages: InfinitePage<T>[] } | undefined
): number {
  if (!data) return 0;
  return data.pages.reduce((sum, page) => sum + page.items.length, 0);
}
