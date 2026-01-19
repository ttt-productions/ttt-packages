import type { UploadSessionPersistenceAdapter, UploadSessionState } from "../types";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function createLocalStorageUploadSessionPersistence(opts?: {
  /** Prefix for keys. Default: "ttt_upload_session:" */
  prefix?: string;
}): UploadSessionPersistenceAdapter {
  const prefix = opts?.prefix ?? "ttt_upload_session:";

  const k = (id: string) => `${prefix}${id}`;

  const safeParse = (raw: string | null): UploadSessionState | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UploadSessionState;
    } catch {
      return null;
    }
  };

  return {
    listIds: () => {
      if (!hasLocalStorage()) return [];
      const ids: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (!key.startsWith(prefix)) continue;
        ids.push(key.slice(prefix.length));
      }
      return ids;
    },

    get: (id: string) => {
      if (!hasLocalStorage()) return null;
      return safeParse(window.localStorage.getItem(k(id)));
    },

    set: (id: string, state: UploadSessionState) => {
      if (!hasLocalStorage()) return;
      window.localStorage.setItem(k(id), JSON.stringify(state));
    },

    remove: (id: string) => {
      if (!hasLocalStorage()) return;
      window.localStorage.removeItem(k(id));
    },
  };
}
