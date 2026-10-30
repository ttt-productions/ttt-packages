export function toPath(segments: readonly string[]): string {
  return segments.join('/');
}

// Firestore's limit on a document id, in UTF-8 bytes.
export const MAX_DOCUMENT_ID_BYTES = 1500;

const RESERVED_DOCUMENT_ID_PATTERN = /^__.*__$/;

export function isDocumentIdSegment(id: string): boolean {
  if (id.length === 0 || id.includes('/')) return false;
  if (id === '.' || id === '..') return false;
  if (RESERVED_DOCUMENT_ID_PATTERN.test(id)) return false;
  return new TextEncoder().encode(id).length <= MAX_DOCUMENT_ID_BYTES;
}
