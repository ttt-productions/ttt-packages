export async function passThroughModule<M extends object>(
  importOriginal: () => Promise<M>,
  overrides: NoInfer<Partial<M>>,
): Promise<M> {
  return Object.defineProperties(
    { ...(await importOriginal()) },
    Object.getOwnPropertyDescriptors(overrides),
  );
}

// `importOriginal` gives the stub its module's type only; the real module never loads.
export function stubModule<M extends object>(
  _importOriginal: () => Promise<M>,
  stubs: NoInfer<Partial<M>>,
): Partial<M> {
  return stubs;
}
