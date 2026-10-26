export function stubModule<M extends object>(stubs: Partial<M>): Partial<M> {
  return stubs;
}

export async function passThroughModule<M extends object>(
  importOriginal: () => Promise<M>,
  overrides: Partial<M>,
): Promise<M> {
  return Object.defineProperties(
    { ...(await importOriginal()) },
    Object.getOwnPropertyDescriptors(overrides),
  );
}
