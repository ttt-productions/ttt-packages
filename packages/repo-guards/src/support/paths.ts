// Repo-relative path arithmetic every guard area shares: one normalizer, which says when a path climbs
// above where it started. Internal to the package: no public entry exports it.

/** A forward-slashed path with its `.`, empty, and `..` segments resolved. */
export interface NormalizedPath {
  /** The resolved path; `''` is the starting folder, and a climb above it keeps its leading `..`. */
  path: string;
  /** True when a `..` climbed above the starting folder. */
  escapes: boolean;
}

/** Resolves the `.`, empty, and `..` segments of a forward-slashed path. */
export function normalizePath(path: string): NormalizedPath {
  const out: string[] = [];
  let escapes = false;
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else {
        escapes = true;
        out.push(segment);
      }
    } else out.push(segment);
  }
  return { path: out.join('/'), escapes };
}

/** The folder a repo-relative path sits in; `''` for the repository root. */
export const dirnameOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

/** The path a relative specifier names from the file `fromPath`, or null for a package specifier. */
export function resolveRelative(fromPath: string, spec: string): NormalizedPath | null {
  if (!spec.startsWith('./') && !spec.startsWith('../') && spec !== '.' && spec !== '..')
    return null;
  return normalizePath(`${dirnameOf(fromPath)}/${spec}`);
}
