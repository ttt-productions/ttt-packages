// Under vitest, every overlapping dynamic import of a mocked module but the first resolves to the
// real module, so all callers share one import.
export function lazyModule<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
}
