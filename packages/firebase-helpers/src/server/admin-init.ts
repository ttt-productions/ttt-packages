// The modular Admin SDK entry points (`firebase-admin/app`, `/firestore`, `/auth`,
// `/storage`) are the only ones that exist across the whole supported peer range:
// firebase-admin 14 removed the legacy `admin.*` namespace from the package root, so
// `admin.apps` / `admin.app()` / `admin.app.App` / `admin.credential.Credential` are
// gone there. The modular entries have existed since v10, so this file works on every
// version the peer range allows.
import admin from "firebase-admin";
import {
  getApp,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
  type Credential,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let cachedApp: App | undefined;

export interface AdminInitOptions {
  /** Optional credential. If omitted, uses `applicationDefault()` from the environment. */
  credential?: Credential;
  /** Optional service-account project id / storage bucket overrides. */
  projectId?: string;
  storageBucket?: string;
}

export interface AdminAppHandles {
  /**
   * The modular `App` — `{ name, options }` only. It carries NO legacy service
   * accessors: use the `db` / `auth` / `storage` handles below, or the modular
   * `getFirestore(app)` / `getAuth(app)` / `getStorage(app)`, never `app.firestore()`.
   */
  app: App;
  db: Firestore;
  auth: Auth;
  storage: Storage;
  /**
   * LEGACY, firebase-admin <=13 ONLY. This is the `firebase-admin` package root, which
   * is the `admin.*` namespace up to v13 and NOTHING USEFUL in v14 — the v14 root has no
   * `firestore` / `auth` / `storage` / `credential` / `apps`, so `admin.firestore.FieldValue`,
   * `admin.firestore.Timestamp`, `admin.auth()` and friends are `undefined` there and throw
   * at the dereference. Consumers must migrate every such call site to the modular imports
   * (`FieldValue` / `Timestamp` from `firebase-admin/firestore`, `getAuth` from
   * `firebase-admin/auth`, …) BEFORE upgrading to firebase-admin 14. The field is kept so
   * the v13 consumers that still dereference it are unaffected by this file's conversion.
   */
  admin: typeof admin;
}

/**
 * Idempotent Admin SDK init. Returns a memoized handle to app + common services.
 * Safe to call from Cloud Function module top-level.
 */
export function getAdminApp(options: AdminInitOptions = {}): AdminAppHandles {
  if (!cachedApp) {
    if (getApps().length === 0) {
      // Build options object with only defined fields. Calling
      // `initializeApp({ credential: undefined, ... })` is NOT the same as
      // `initializeApp()` — the SDK sees the `credential` key and treats
      // `undefined` as a user-supplied credential, throwing
      // "credential must be an object which implements the Credential interface."
      // No-arg `initializeApp()` is the magic path that lazily reads
      // GOOGLE_APPLICATION_CREDENTIALS from the environment.
      const appOptions: AppOptions = {};
      if (options.credential !== undefined) appOptions.credential = options.credential;
      if (options.projectId !== undefined) appOptions.projectId = options.projectId;
      if (options.storageBucket !== undefined) appOptions.storageBucket = options.storageBucket;

      if (Object.keys(appOptions).length === 0) {
        initializeApp();
      } else {
        initializeApp(appOptions);
      }
    }
    cachedApp = getApp();
  }
  return {
    app: cachedApp,
    db: getFirestore(cachedApp),
    auth: getAuth(cachedApp),
    storage: getStorage(cachedApp),
    admin,
  };
}
