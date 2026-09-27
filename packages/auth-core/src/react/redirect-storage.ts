// The post-login redirect path lives in localStorage. A browser that blocks site data throws
// on the storage access itself (FRONTEND-010), so every access here is guarded: a blocked read
// is "nothing saved", and a blocked write keeps the value in memory for the page's life so a
// same-page sign-in still lands on it. Outside a browser every call is a no-op.

const memory = new Map<string, string>();

function inBrowser(): boolean {
  return typeof window !== "undefined";
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
  } catch {
    // Blocked store: fall through to the page-life copy.
  }
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
    } catch {
      // Blocked store: keep the page-life copy below.
    }
  }
  memory.set(key, path);
}

export function clearRedirectPath(key: string): void {
  if (!inBrowser()) return;
  memory.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    // Blocked store: nothing was persisted there.
  }
}
