import { createRequire } from 'node:module';
import type admin from 'firebase-admin';
import {
  getApp,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
  type Credential,
} from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';

// Auth, Storage, and the package root load on first read: most callers use only Firestore, and each
// module loaded at import time is paid on every cold start.
const loadModule = createRequire(import.meta.url);

let cachedApp: App | undefined;

export interface AdminInitOptions {
  credential?: Credential;
  projectId?: string;
  storageBucket?: string;
}

export interface AdminAppHandles {
  app: App;
  db: Firestore;
  readonly auth: Auth;
  readonly storage: Storage;
  /** firebase-admin <=13 only: the v14 package root has no `firestore` / `auth` / `storage` namespaces. */
  readonly admin: typeof admin;
}

export function getAdminApp(options: AdminInitOptions = {}): AdminAppHandles {
  if (!cachedApp) {
    if (getApps().length === 0) {
      // `initializeApp({ credential: undefined })` throws where `initializeApp()` reads the environment,
      // so only defined fields are passed.
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
  const app = cachedApp;
  return {
    app,
    db: getFirestore(app),
    get auth() {
      return (loadModule('firebase-admin/auth') as typeof import('firebase-admin/auth')).getAuth(
        app,
      );
    },
    get storage() {
      return (
        loadModule('firebase-admin/storage') as typeof import('firebase-admin/storage')
      ).getStorage(app);
    },
    get admin() {
      return loadModule('firebase-admin') as typeof admin;
    },
  };
}

export function __resetAdminAppCache(): void {
  cachedApp = undefined;
}
