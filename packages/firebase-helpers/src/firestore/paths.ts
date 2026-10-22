const clean = (s: string) => s.replace(/^\/+|\/+$/g, '').trim();

export function joinPath(...parts: Array<string | number | null | undefined>): string {
  const tokens = parts
    .filter((p): p is string | number => p !== null && p !== undefined)
    .map(String)
    .map(clean)
    .filter(Boolean);

  return tokens.join('/');
}

export function colPath(...segments: Array<string | number>): string {
  return joinPath(...segments);
}

export function docPath(...segments: Array<string | number>): string {
  return joinPath(...segments);
}

export function makeRootPaths(root: string) {
  return {
    root: clean(root),
    col: (...segments: Array<string | number>) => colPath(root, ...segments),
    doc: (...segments: Array<string | number>) => docPath(root, ...segments),
  };
}
