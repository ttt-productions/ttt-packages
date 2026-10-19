/**
 * A memoized dynamic import: `const loadX = lazyModule(() => import('x'))` at module level. The
 * module is imported on first use, and every later or concurrent call awaits that one import, so one
 * importer never has two imports of a module in flight — under vitest, every overlapping dynamic
 * import of a MOCKED module but the first resolves to the REAL module, so a concurrent path would
 * silently run against real code. A failed import is dropped, so the next call imports again: a
 * transient load failure (a network-fetched chunk) does not fail every later call.
 */
export function lazyModule<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
}
