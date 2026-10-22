// firebase-admin 14 removed the root `admin.*` namespace; only the modular entries exist across
// the whole peer range.
import admin from 'firebase-admin';
import {
  getApp,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
  type Credential,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

let cachedApp: App | undefined;

export interface AdminInitOptions {
  credential?: Credential;
  projectId?: string;
  storageBucket?: string;
}

export interface AdminAppHandles {
  app: App;
  db: Firestore;
  auth: Auth;
  storage: Storage;
  /** firebase-admin <=13 only: the v14 package root has no `firestore` / `auth` / `storage` namespaces. */
  admin: typeof admin;
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
  return {
    app: cachedApp,
    db: getFirestore(cachedApp),
    auth: getAuth(cachedApp),
    storage: getStorage(cachedApp),
    admin,
  };
}

export function __resetAdminAppCache(): void {
  cachedApp = undefined;
}
