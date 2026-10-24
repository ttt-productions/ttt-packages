// A browser that blocks site data throws on the storage access itself (RULE-STD-FRONTEND-010).

const memory = new Map<string, string>();

function inBrowser(): boolean {
  return typeof window !== 'undefined';
}

function attempt<T>(access: () => T): T | undefined {
  try {
    return access();
  } catch {
    return undefined;
  }
}

function storage(): Storage | undefined {
  return attempt(() => window.localStorage);
}

export function readRedirectPath(key: string): string | null {
  if (!inBrowser()) return null;
  return attempt(() => storage()?.getItem(key)) ?? memory.get(key) ?? null;
}

export function saveRedirectPath(key: string, path: string): void {
  if (!inBrowser()) return;
  const stored = attempt(() => {
    const store = storage();
    if (!store) return false;
    store.setItem(key, path);
    return true;
  });
  if (stored) {
    memory.delete(key);
    return;
  }
  memory.set(key, path);
}

export function clearRedirectPath(key: string): void {
  if (!inBrowser()) return;
  memory.delete(key);
  attempt(() => storage()?.removeItem(key));
}
