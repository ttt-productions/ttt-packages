// Guarded Web Storage access. A browser that blocks site data throws on every Storage call, even on
// reading `window.localStorage` / `window.sessionStorage`. A blocked read is "nothing saved", and a
// blocked write is held here for the life of the page, so a viewer's choice still takes effect.
// Blocked storage is the viewer's browser setting, not a defect, so it is not reported.

/** Which Web Storage area a value lives in: `local` outlives the tab, `session` ends with it. */
export type DeviceStorageArea = "local" | "session";

const heldValues: Record<DeviceStorageArea, Map<string, string | null>> = {
  local: new Map(),
  session: new Map(),
};

function storageArea(area: DeviceStorageArea): Storage {
  return area === "session" ? window.sessionStorage : window.localStorage;
}

function readStorage(key: string, area: DeviceStorageArea): string | null {
  try {
    return storageArea(area).getItem(key);
  } catch {
    return null;
  }
}

/** The stored value, or `null` when nothing is saved, storage is blocked, or there is no window. */
export function readStoredValue(key: string, area: DeviceStorageArea = "local"): string | null {
  if (typeof window === "undefined") return null;
  const held = heldValues[area];
  if (held.has(key)) return held.get(key) ?? null;
  return readStorage(key, area);
}

/**
 * Stores `value` (`null` removes it), holding it for the page when storage refuses the write. Never
 * throws; a call with no window does nothing.
 */
export function writeStoredValue(
  key: string,
  value: string | null,
  area: DeviceStorageArea = "local",
): void {
  if (typeof window === "undefined") return;
  const held = heldValues[area];
  try {
    const storage = storageArea(area);
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    held.delete(key);
  } catch {
    held.set(key, value);
  }
}

/** Records a value another library was asked to store, holding it for the page if storage did not take it. */
export function noteStoredValue(key: string, value: string): void {
  const held = heldValues.local;
  if (readStorage(key, "local") === value) held.delete(key);
  else held.set(key, value);
}
