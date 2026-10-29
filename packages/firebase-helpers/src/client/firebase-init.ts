import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  initializeAppCheck,
  getToken,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import {
  initializeAnalytics,
  setAnalyticsCollectionEnabled,
  type Analytics,
} from 'firebase/analytics';
import { awaitFirstToken } from './app-check-ready.js';
import { installAuthBootLookupGuard } from './auth-boot-lookup-guard.js';

export interface EmulatorPorts {
  auth?: number;
  firestore?: number;
  functions?: number;
  storage?: number;
  host?: string;
  storageHost?: string;
}

export interface AppCheckClientOptions {
  siteKey?: string;
  debugToken?: string;
}

export interface InitFirebaseClientOptions {
  requiredConfigKeys?: readonly (keyof FirebaseOptions)[];
  useEmulators?: boolean;
  emulatorPorts?: EmulatorPorts;
  functionsRegion?: string;
  useBrowserLocalPersistence?: boolean;
  persistentFirestoreCache?: boolean;
  appCheck?: AppCheckClientOptions;
  authBootLookupGuard?: boolean;
  analyticsConfig?: Record<string, unknown>;
  analyticsEnabled?: boolean;
  onAnalyticsError?: (error: unknown, action: 'enable' | 'collection') => void;
}

export interface FirebaseAnalyticsHandle {
  get: () => Analytics | undefined;
  enable: () => Analytics | undefined;
  setCollectionEnabled: (enabled: boolean) => void;
  subscribe: (listener: () => void) => () => void;
}

export interface FirebaseClientHandles {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  functions: Functions;
  appCheck: AppCheck | undefined;
  whenAppCheckReady: () => Promise<void>;
  analytics: FirebaseAnalyticsHandle;
}

let cached: FirebaseClientHandles | undefined;
const EMULATOR_FLAG = '__FIREBASE_EMULATORS_CONNECTED__';
const APP_CHECK_FLAG = '__APP_CHECK_INITIALIZED__';

function globalFlags(): Record<string, unknown> {
  return globalThis as Record<string, unknown>;
}

function validateConfig(config: FirebaseOptions, required: readonly (keyof FirebaseOptions)[]) {
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Firebase configuration is incomplete. Missing: ${missing.join(', ')}`);
  }
}

function initAppCheck(
  app: FirebaseApp,
  options: AppCheckClientOptions,
  useEmulators: boolean,
): AppCheck | undefined {
  if (typeof window === 'undefined') return undefined;
  if (globalFlags()[APP_CHECK_FLAG]) return undefined;
  const { siteKey } = options;
  const debugToken = useEmulators ? options.debugToken : undefined;
  if (useEmulators && !debugToken) return undefined;

  // Set before initializeAppCheck, which reads it.
  if (debugToken) globalFlags().FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;

  if (!siteKey) {
    console.warn(
      '[firebase] App Check site key is missing — skipping App Check init. Authenticated calls will fail once enforcement is on.',
    );
    return undefined;
  }
  try {
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    globalFlags()[APP_CHECK_FLAG] = true;
    return appCheck;
  } catch (error) {
    // initializeAppCheck throws on a second init of the same app (a hot reload).
    console.warn('[firebase] App Check initialization failed:', error);
    return undefined;
  }
}

function initFirestore(app: FirebaseApp, persistent: boolean): Firestore {
  if (!persistent || typeof window === 'undefined') return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // initializeFirestore throws once Firestore exists for this app (a hot reload): reuse it.
    return getFirestore(app);
  }
}

function connectEmulators(
  handles: Pick<FirebaseClientHandles, 'db' | 'auth' | 'storage' | 'functions'>,
  options: InitFirebaseClientOptions,
) {
  if (typeof window === 'undefined' || globalFlags()[EMULATOR_FLAG]) return;
  const ports = options.emulatorPorts ?? {};
  const host = ports.host ?? 'localhost';
  if (options.useBrowserLocalPersistence) {
    setPersistence(handles.auth, browserLocalPersistence).catch((error: unknown) => {
      console.warn('[firebase] Auth persistence could not be set:', error);
    });
  }
  connectAuthEmulator(handles.auth, `http://${host}:${ports.auth ?? 9099}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(handles.db, host, ports.firestore ?? 8080);
  connectFunctionsEmulator(handles.functions, host, ports.functions ?? 5001);
  connectStorageEmulator(handles.storage, ports.storageHost ?? host, ports.storage ?? 9199);
  globalFlags()[EMULATOR_FLAG] = true;
}

function createAnalyticsHandle(
  app: FirebaseApp,
  measurementId: string | undefined,
  options: InitFirebaseClientOptions,
): FirebaseAnalyticsHandle {
  const config = options.analyticsConfig;
  const available =
    Boolean(measurementId) && !options.useEmulators && (options.analyticsEnabled ?? true);
  const reportError = (error: unknown, action: 'enable' | 'collection') => {
    if (options.onAnalyticsError) options.onAnalyticsError(error, action);
    else console.warn(`[firebase] Analytics ${action} failed:`, error);
  };
  let analytics: Analytics | undefined;
  const listeners = new Set<() => void>();

  return {
    get: () => analytics,
    enable: () => {
      if (typeof window === 'undefined' || !available) return undefined;
      const created = !analytics;
      try {
        if (!analytics) analytics = initializeAnalytics(app, config ? { config } : undefined);
        setAnalyticsCollectionEnabled(analytics, true);
      } catch (error) {
        reportError(error, 'enable');
      }
      if (created && analytics) for (const listener of listeners) listener();
      return analytics;
    },
    // The SDK cannot be torn down once initialized, so this only stops collection.
    setCollectionEnabled: (enabled) => {
      if (!analytics) return;
      try {
        setAnalyticsCollectionEnabled(analytics, enabled);
      } catch (error) {
        reportError(error, 'collection');
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function initFirebaseClient(
  config: FirebaseOptions,
  options: InitFirebaseClientOptions = {},
): FirebaseClientHandles {
  if (cached) return cached;

  validateConfig(config, options.requiredConfigKeys ?? []);
  const useEmulators = options.useEmulators ?? false;
  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0]!;
  const appCheck = options.appCheck ? initAppCheck(app, options.appCheck, useEmulators) : undefined;

  // Installed before getAuth(), which starts the SDK's boot `accounts:lookup` at once.
  if (options.authBootLookupGuard) {
    installAuthBootLookupGuard({
      refreshAttestation: async () => {
        if (!appCheck) return;
        try {
          await getToken(appCheck, true);
        } catch {
          // A failed refresh leaves the retried lookup to classify the attestation failure itself.
        }
      },
    });
  }

  const db = initFirestore(app, Boolean(options.persistentFirestoreCache) && !useEmulators);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, options.functionsRegion);
  if (useEmulators) connectEmulators({ db, auth, storage, functions }, options);

  let appCheckReady: Promise<void> | undefined;
  const whenAppCheckReady = () => {
    appCheckReady ??= (async () => {
      if (!appCheck) return;
      await awaitFirstToken({
        getToken: () => getToken(appCheck, false),
        onExhausted: (lastError) => {
          console.warn(
            '[firebase] App Check token could not be minted after retries — proceeding fail-open; data reads may be rejected until the SDK recovers.',
            lastError,
          );
        },
      });
    })();
    return appCheckReady;
  };

  cached = {
    app,
    db,
    auth,
    storage,
    functions,
    appCheck,
    whenAppCheckReady,
    analytics: createAnalyticsHandle(app, config.measurementId, options),
  };
  return cached;
}

export function getFirebaseClient(): FirebaseClientHandles {
  if (!cached)
    throw new Error('Firebase client is not initialized — call initFirebaseClient first');
  return cached;
}

export function tryGetFirebaseClient(): FirebaseClientHandles | undefined {
  return cached;
}

export function __resetFirebaseClientCache() {
  cached = undefined;
  globalFlags()[EMULATOR_FLAG] = undefined;
  globalFlags()[APP_CHECK_FLAG] = undefined;
}
