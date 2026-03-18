// Utility to convert path tuples to slash-delimited strings for Admin SDK.
//
// Usage: db.doc(toPath(PATH_BUILDERS.userProfile(userId)))

export function toPath(segments: readonly string[]): string {
  return segments.join('/');
}
