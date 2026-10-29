export type PersistedAuthUserPeek = { existed: boolean; uid?: string };

const AUTH_DATABASE = 'firebaseLocalStorageDb';
const AUTH_STORE = 'firebaseLocalStorage';
const AUTH_USER_KEY_PREFIX = 'firebase:authUser:';

export function peekPersistedAuthUser(): Promise<PersistedAuthUserPeek> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve({ existed: false });
        return;
      }
      const request = indexedDB.open(AUTH_DATABASE);
      // An upgrade means the database did not exist: the open is aborted so the peek never creates
      // an empty one the Auth SDK would later trust.
      request.onupgradeneeded = () => {
        try {
          request.transaction?.abort();
        } catch {
          // The resolve below runs either way.
        }
        resolve({ existed: false });
      };
      request.onerror = () => resolve({ existed: false });
      request.onsuccess = () => {
        const db = request.result;
        try {
          if (!db.objectStoreNames.contains(AUTH_STORE)) {
            db.close();
            resolve({ existed: false });
            return;
          }
          const getAll = db.transaction(AUTH_STORE, 'readonly').objectStore(AUTH_STORE).getAll();
          getAll.onsuccess = () => {
            const rows = (getAll.result ?? []) as Array<{
              fbase_key?: string;
              value?: { uid?: string };
            }>;
            const row = rows.find(
              (candidate) =>
                typeof candidate.fbase_key === 'string' &&
                candidate.fbase_key.startsWith(AUTH_USER_KEY_PREFIX),
            );
            db.close();
            resolve(row ? { existed: true, uid: row.value?.uid } : { existed: false });
          };
          getAll.onerror = () => {
            db.close();
            resolve({ existed: false });
          };
        } catch {
          db.close();
          resolve({ existed: false });
        }
      };
    } catch {
      resolve({ existed: false });
    }
  });
}
