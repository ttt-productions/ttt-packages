// A browser that blocks site data throws on every Storage call, even on reading
// `window.localStorage`. Blocked storage is the viewer's setting, not a defect, so it is not reported.

export type DeviceStorageArea = 'local' | 'session';

const heldValues: Record<DeviceStorageArea, Map<string, string | null>> = {
  local: new Map(),
  session: new Map(),
};

function storageArea(area: DeviceStorageArea): Storage {
  return area === 'session' ? window.sessionStorage : window.localStorage;
}

function readStorage(key: string, area: DeviceStorageArea): string | null {
  try {
    return storageArea(area).getItem(key);
  } catch {
    return null;
  }
}

export function readStoredValue(key: string, area: DeviceStorageArea = 'local'): string | null {
  if (typeof window === 'undefined') return null;
  const held = heldValues[area];
  if (held.has(key)) return held.get(key) ?? null;
  return readStorage(key, area);
}

export function writeStoredValue(
  key: string,
  value: string | null,
  area: DeviceStorageArea = 'local',
): void {
  if (typeof window === 'undefined') return;
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

export function noteStoredValue(key: string, value: string): void {
  const held = heldValues.local;
  if (readStorage(key, 'local') === value) held.delete(key);
  else held.set(key, value);
}
