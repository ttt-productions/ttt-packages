export const FIRESTORE_SEARCH_MIN_LENGTH = 3;

export function normalizeSearchText(text: string): string {
  return text.toLowerCase().trim();
}

export function isSearchableText(text: string): boolean {
  return normalizeSearchText(text).length >= FIRESTORE_SEARCH_MIN_LENGTH;
}
