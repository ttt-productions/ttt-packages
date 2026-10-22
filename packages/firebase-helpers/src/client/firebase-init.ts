import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

export interface EmulatorPorts {
  auth?: number;
  firestore?: number;
  functions?: number;
  storage?: number;
  host?: string;
}

export interface InitFirebaseClientOptions {
  useEmulators?: boolean;
  emulatorPorts?: EmulatorPorts;
  useBrowserLocalPersistence?: boolean;
}

export interface FirebaseClientHandles {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  functions: Functions;
}

let cached: FirebaseClientHandles | undefined;
const EMULATOR_FLAG = '__FIREBASE_EMULATORS_CONNECTED__';

export function initFirebaseClient(
  config: FirebaseOptions,
  options: InitFirebaseClientOptions = {},
): FirebaseClientHandles {
  if (cached) return cached;

  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0]!;
  const db = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const functions = getFunctions(app);

  if (options.useEmulators && typeof window !== 'undefined') {
    const flagged = (globalThis as Record<string, unknown>)[EMULATOR_FLAG];
    if (!flagged) {
      const host = options.emulatorPorts?.host ?? 'localhost';
      const ports = options.emulatorPorts ?? {};
      if (options.useBrowserLocalPersistence) {
        setPersistence(auth, browserLocalPersistence).catch(() => {});
      }
      connectAuthEmulator(auth, `http://${host}:${ports.auth ?? 9099}`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, ports.firestore ?? 8080);
      connectFunctionsEmulator(functions, host, ports.functions ?? 5001);
      connectStorageEmulator(storage, host, ports.storage ?? 9199);
      (globalThis as Record<string, unknown>)[EMULATOR_FLAG] = true;
    }
  }

  cached = { app, db, auth, storage, functions };
  return cached;
}

export function __resetFirebaseClientCache() {
  cached = undefined;
  (globalThis as Record<string, unknown>)[EMULATOR_FLAG] = undefined;
}
