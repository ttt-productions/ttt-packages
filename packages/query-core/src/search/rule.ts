/** The fewest characters, counted on the normalized text, that `useFirestoreSearch` searches. */
export const FIRESTORE_SEARCH_MIN_LENGTH = 3;

/**
 * The text `useFirestoreSearch` reads for a typed text: lowercased, surrounding whitespace dropped.
 * Two typed texts with the same normalized text are the same search.
 */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().trim();
}

/** Whether `useFirestoreSearch` searches this typed text (its normalized length reaches the minimum). */
export function isSearchableText(text: string): boolean {
  return normalizeSearchText(text).length >= FIRESTORE_SEARCH_MIN_LENGTH;
}
