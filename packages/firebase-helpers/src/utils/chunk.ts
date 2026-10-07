/**
 * The most values Firestore accepts in one `in` (or `not-in`, `array-contains-any`) filter. A
 * longer id list is split with `chunk(ids, FIRESTORE_IN_FILTER_LIMIT)` into one read per chunk.
 */
export const FIRESTORE_IN_FILTER_LIMIT = 30;

export function chunk<T>(items: T[], size: number): T[][] {
    if (!Number.isFinite(size) || size <= 0) throw new Error(`chunk size must be > 0 (got ${size})`);
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
  }
