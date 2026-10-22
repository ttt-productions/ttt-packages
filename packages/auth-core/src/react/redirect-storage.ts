// A browser that blocks site data throws on the storage access itself (RULE-STD-FRONTEND-010).

const memory = new Map<string, string>();

function inBrowser(): boolean {
  return typeof window !== 'undefined';
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRedirectPath(key: string): string | null {
  if (!inBrowser()) return null;
  try {
    const saved = storage()?.getItem(key) ?? null;
    if (saved !== null) return saved;
  } catch {}
  return memory.get(key) ?? null;
}

export function saveRedirectPath(key: string, path: string): void {
  if (!inBrowser()) return;
  const store = storage();
  if (store) {
    try {
      store.setItem(key, path);
      memory.delete(key);
      return;
    } catch {}
  }
  memory.set(key, path);
}

export function clearRedirectPath(key: string): void {
  if (!inBrowser()) return;
  memory.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {}
}
