// localStorage access for the viewer settings. A browser that blocks site data throws on every
// localStorage call, even on reading `window.localStorage`. A blocked read is "nothing saved", and a
// blocked write is held here for the life of the page, so a viewer's choice still takes effect.
// Blocked storage is the viewer's browser setting, not a defect, so it is not reported.

const heldValues = new Map<string, string | null>();

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The stored value, or `null` when nothing is saved or storage is blocked. */
export function readStoredValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (heldValues.has(key)) return heldValues.get(key) ?? null;
  return readStorage(key);
}

/** Stores `value` (`null` removes it), holding it for the page when storage refuses the write. */
export function writeStoredValue(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    heldValues.delete(key);
  } catch {
    heldValues.set(key, value);
  }
}

/** Records a value another library was asked to store, holding it for the page if storage did not take it. */
export function noteStoredValue(key: string, value: string): void {
  if (readStorage(key) === value) heldValues.delete(key);
  else heldValues.set(key, value);
}
