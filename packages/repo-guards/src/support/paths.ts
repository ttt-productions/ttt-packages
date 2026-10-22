export interface NormalizedPath {
  path: string;
  escapes: boolean;
}

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

export const dirnameOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

export function resolveRelative(fromPath: string, spec: string): NormalizedPath | null {
  if (!spec.startsWith('./') && !spec.startsWith('../') && spec !== '.' && spec !== '..')
    return null;
  return normalizePath(`${dirnameOf(fromPath)}/${spec}`);
}
