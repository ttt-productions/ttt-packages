import type { WithId } from '../../firestore/types.js';
import type { InfinitePage } from './types.js';

export function flattenInfiniteData<T>(
  data: { pages: InfinitePage<T>[] } | undefined,
): WithId<T>[] {
  if (!data) return [];
  return data.pages.flatMap((page) => page.items);
}

export function getInfiniteDataCount<T>(data: { pages: InfinitePage<T>[] } | undefined): number {
  if (!data) return 0;
  return data.pages.reduce((sum, page) => sum + page.items.length, 0);
}
