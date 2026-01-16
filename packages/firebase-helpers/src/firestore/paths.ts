/**
 * Firestore path utilities.
 * - No app-specific collection names live here.
 * - Use these as building blocks for app-level constants.
 */

const clean = (s: string) => s.replace(/^\/+|\/+$/g, "").trim();

export function joinPath(...parts: Array<string | number | null | undefined>): string {
  const tokens = parts
    .filter((p): p is string | number => p !== null && p !== undefined)
    .map(String)
    .map(clean)
    .filter(Boolean);

  return tokens.join("/");
}

/** Build a collection path from segments */
export function colPath(...segments: Array<string | number>): string {
  return joinPath(...segments);
}

/** Build a document path from segments */
export function docPath(...segments: Array<string | number>): string {
  return joinPath(...segments);
}

/**
 * Create helpers for a "root" namespace.
 * Example:
 *   const paths = makeRootPaths("ttt");
 *   paths.col("users") -> "ttt/users"
 *   paths.doc("users", uid) -> "ttt/users/<uid>"
 */
export function makeRootPaths(root: string) {
  return {
    root: clean(root),
    col: (...segments: Array<string | number>) => colPath(root, ...segments),
    doc: (...segments: Array<string | number>) => docPath(root, ...segments),
  };
}
