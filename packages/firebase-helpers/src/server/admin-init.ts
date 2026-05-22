import admin from "firebase-admin";

let cachedApp: admin.app.App | undefined;

export interface AdminInitOptions {
  /** Optional credential. If omitted, uses `applicationDefault()` from the environment. */
  credential?: admin.credential.Credential;
  /** Optional service-account project id / storage bucket overrides. */
  projectId?: string;
  storageBucket?: string;
}

export interface AdminAppHandles {
  app: admin.app.App;
  db: ReturnType<admin.app.App["firestore"]>;
  auth: ReturnType<admin.app.App["auth"]>;
  storage: ReturnType<admin.app.App["storage"]>;
  admin: typeof admin;
}

/**
 * Idempotent Admin SDK init. Returns a memoized handle to app + common services.
 * Safe to call from Cloud Function module top-level.
 */
export function getAdminApp(options: AdminInitOptions = {}): AdminAppHandles {
  if (!cachedApp) {
    if (admin.apps.length === 0) {
      // Build options object with only defined fields. Calling
      // `initializeApp({ credential: undefined, ... })` is NOT the same as
      // `initializeApp()` — the SDK sees the `credential` key and treats
      // `undefined` as a user-supplied credential, throwing
      // "credential must be an object which implements the Credential interface."
      // No-arg `initializeApp()` is the magic path that lazily reads
      // GOOGLE_APPLICATION_CREDENTIALS from the environment.
      const appOptions: admin.AppOptions = {};
      if (options.credential !== undefined) appOptions.credential = options.credential;
      if (options.projectId !== undefined) appOptions.projectId = options.projectId;
      if (options.storageBucket !== undefined) appOptions.storageBucket = options.storageBucket;

      if (Object.keys(appOptions).length === 0) {
        admin.initializeApp();
      } else {
        admin.initializeApp(appOptions);
      }
    }
    cachedApp = admin.app();
  }
  return {
    app: cachedApp,
    db: cachedApp.firestore(),
    auth: cachedApp.auth(),
    storage: cachedApp.storage(),
    admin,
  };
}
