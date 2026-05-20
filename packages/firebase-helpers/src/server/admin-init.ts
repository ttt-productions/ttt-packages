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
      admin.initializeApp({
        credential: options.credential,
        projectId: options.projectId,
        storageBucket: options.storageBucket,
      });
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
