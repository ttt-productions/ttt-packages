// Utility to convert path tuples to slash-delimited strings for Admin SDK.
//
// Usage: db.doc(toPath(PATH_BUILDERS.userProfile(userId)))

export function toPath(segments: readonly string[]): string {
  return segments.join('/');
}

// Firestore's limit on a document id, in UTF-8 bytes.
export const MAX_DOCUMENT_ID_BYTES = 1500;

const RESERVED_DOCUMENT_ID_PATTERN = /^__.*__$/;

/**
 * Whether `id` names exactly one document under its collection: non-empty, no `/`, at most
 * `MAX_DOCUMENT_ID_BYTES` UTF-8 bytes, not `.` or `..`, and not an id Firestore reserves (`__…__`).
 * A `/` would address another document or a subcollection, and an empty id the collection itself,
 * so every id atom a path is built from checks this before any path exists (RULE-STD-ARCH-106).
 */
export function isDocumentIdSegment(id: string): boolean {
  if (id.length === 0 || id.includes('/')) return false;
  if (id === '.' || id === '..') return false;
  if (RESERVED_DOCUMENT_ID_PATTERN.test(id)) return false;
  return new TextEncoder().encode(id).length <= MAX_DOCUMENT_ID_BYTES;
}
