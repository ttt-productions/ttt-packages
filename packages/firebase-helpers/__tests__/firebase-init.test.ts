import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Real SDK instances the stubs hand out; building them opens no connection.
const sdk = await vi.hoisted(async () => {
  const { initializeApp } = await vi.importActual<typeof import('firebase/app')>('firebase/app');
  const firestore =
    await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  const auth = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  const storage = await vi.importActual<typeof import('firebase/storage')>('firebase/storage');
  const app = initializeApp({ apiKey: 'k', projectId: 'p', appId: 'a' }, 'firebase-init-fixtures');
  return {
    db: firestore.getFirestore(app),
    persistentDb: firestore.getFirestore(app, 'persistent'),
    auth: auth.getAuth(app),
    storage: storage.getStorage(app),
    appCheck: { app },
    analytics: { app },
  };
});

const h = vi.hoisted(() => ({
  order: [] as string[],
  providerSiteKeys: [] as string[],
  initializeAppCheck: vi.fn<typeof import('firebase/app-check').initializeAppCheck>(),
  getToken: vi.fn<typeof import('firebase/app-check').getToken>(async () => ({ token: 't' })),
  initializeAnalytics: vi.fn<typeof import('firebase/analytics').initializeAnalytics>(),
  setAnalyticsCollectionEnabled:
    vi.fn<typeof import('firebase/analytics').setAnalyticsCollectionEnabled>(),
  installAuthBootLookupGuard:
    vi.fn<typeof import('../src/client/auth-boot-lookup-guard.js').installAuthBootLookupGuard>(),
  initializeFirestore: vi.fn<typeof import('firebase/firestore').initializeFirestore>(),
  getFirestore: vi.fn<() => import('firebase/firestore').Firestore>(),
}));

vi.mock('firebase/app-check', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  type AppCheckModule = typeof import('firebase/app-check');
  const actual = await importOriginal<AppCheckModule>();
  class RecordingProvider extends actual.ReCaptchaEnterpriseProvider {
    constructor(siteKey: string) {
      super(siteKey);
      h.providerSiteKeys.push(siteKey);
    }
  }
  return passThroughModule<AppCheckModule>(importOriginal, {
    initializeAppCheck: h.initializeAppCheck,
    getToken: h.getToken,
    ReCaptchaEnterpriseProvider: RecordingProvider,
  });
});
vi.mock('firebase/analytics', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  return passThroughModule<typeof import('firebase/analytics')>(importOriginal, {
    initializeAnalytics: h.initializeAnalytics,
    setAnalyticsCollectionEnabled: h.setAnalyticsCollectionEnabled,
  });
});
vi.mock('firebase/firestore', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  return passThroughModule<typeof import('firebase/firestore')>(importOriginal, {
    getFirestore: () => h.getFirestore(),
    initializeFirestore: h.initializeFirestore,
    connectFirestoreEmulator: vi.fn(),
  });
});
vi.mock('firebase/auth', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  return passThroughModule<typeof import('firebase/auth')>(importOriginal, {
    getAuth: () => {
      h.order.push('getAuth');
      return sdk.auth;
    },
    connectAuthEmulator: vi.fn(),
    setPersistence: vi.fn(async () => undefined),
  });
});
vi.mock('firebase/storage', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  return passThroughModule<typeof import('firebase/storage')>(importOriginal, {
    getStorage: () => sdk.storage,
    connectStorageEmulator: vi.fn(),
  });
});
vi.mock('../src/client/auth-boot-lookup-guard.js', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('../src/client/auth-boot-lookup-guard.js')>({
    installAuthBootLookupGuard: (...args) => {
      h.order.push('guard');
      h.installAuthBootLookupGuard(...args);
    },
  });
});

import { connectAuthEmulator } from 'firebase/auth';
import { connectStorageEmulator } from 'firebase/storage';
import {
  initFirebaseClient,
  getFirebaseClient,
  tryGetFirebaseClient,
  __resetFirebaseClientCache,
} from '../src/client/firebase-init.js';

const CONFIG = { apiKey: 'k', projectId: 'p', appId: 'a' };

function withWindow(run: () => void) {
  const scope = globalThis as Record<string, unknown>;
  const hadWindow = 'window' in scope;
  const previousWindow = scope.window;
  const previousSelf = scope.self;
  scope.window = scope;
  scope.self = scope;
  try {
    run();
  } finally {
    if (hadWindow) scope.window = previousWindow;
    else delete scope.window;
    scope.self = previousSelf;
  }
}

beforeEach(() => {
  __resetFirebaseClientCache();
  h.order.length = 0;
  h.providerSiteKeys.length = 0;
  vi.clearAllMocks();
  h.initializeAppCheck.mockImplementation(() => sdk.appCheck);
  h.initializeAnalytics.mockImplementation(() => sdk.analytics);
  h.initializeFirestore.mockImplementation(() => sdk.persistentDb);
  h.getFirestore.mockImplementation(() => sdk.db);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initFirebaseClient', () => {
  it('returns handles with app, db, auth, storage, functions', () => {
    const result = initFirebaseClient(CONFIG);
    expect(result).toHaveProperty('app');
    expect(result).toHaveProperty('db');
    expect(result).toHaveProperty('auth');
    expect(result).toHaveProperty('storage');
    expect(result).toHaveProperty('functions');
  });

  it('is idempotent — returns the same cached handles on second call', () => {
    const first = initFirebaseClient({ apiKey: 'a', projectId: 'p' });
    const second = initFirebaseClient({ apiKey: 'b', projectId: 'q' });
    expect(first).toBe(second);
  });

  it('__resetFirebaseClientCache clears the cache', () => {
    const first = initFirebaseClient({ apiKey: 'a' });
    __resetFirebaseClientCache();
    const second = initFirebaseClient({ apiKey: 'b' });
    expect(first).not.toBe(second);
  });

  it('does not connect emulators when useEmulators is false', () => {
    withWindow(() => initFirebaseClient(CONFIG, { useEmulators: false }));
    expect(connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('does not connect emulators when window is undefined (SSR)', () => {
    initFirebaseClient(CONFIG, { useEmulators: true });
    expect(connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('refuses a config missing a key the app requires, naming every missing key', () => {
    expect(() =>
      initFirebaseClient({ apiKey: 'k' }, { requiredConfigKeys: ['apiKey', 'projectId', 'appId'] }),
    ).toThrow('Firebase configuration is incomplete. Missing: projectId, appId');
    expect(tryGetFirebaseClient()).toBeUndefined();
  });

  it('connects every emulator on the given host, the storage emulator on its own host', () => {
    withWindow(() =>
      initFirebaseClient(CONFIG, {
        useEmulators: true,
        emulatorPorts: { host: '127.0.0.1', auth: 1, storage: 4, storageHost: 'localhost' },
      }),
    );
    expect(connectAuthEmulator).toHaveBeenCalledWith(expect.anything(), 'http://127.0.0.1:1', {
      disableWarnings: true,
    });
    expect(connectStorageEmulator).toHaveBeenCalledWith(sdk.storage, 'localhost', 4);
  });
});

describe('initFirebaseClient — Firestore cache', () => {
  it('uses the multi-tab persistent cache in the browser when asked', () => {
    let db: unknown;
    withWindow(() => {
      db = initFirebaseClient(CONFIG, { persistentFirestoreCache: true }).db;
    });
    expect(db).toBe(sdk.persistentDb);
  });

  it('never uses the persistent cache under the emulators', () => {
    withWindow(() =>
      initFirebaseClient(CONFIG, { persistentFirestoreCache: true, useEmulators: true }),
    );
    expect(h.initializeFirestore).not.toHaveBeenCalled();
  });

  it('reuses the existing Firestore when the persistent init throws (a second init)', () => {
    h.initializeFirestore.mockImplementationOnce(() => {
      throw new Error('already initialized');
    });
    let db: unknown;
    withWindow(() => {
      db = initFirebaseClient(CONFIG, { persistentFirestoreCache: true }).db;
    });
    expect(db).toBe(sdk.db);
  });
});

describe('initFirebaseClient — App Check', () => {
  it('initializes App Check with the reCAPTCHA Enterprise provider and auto-refresh', () => {
    withWindow(() => initFirebaseClient(CONFIG, { appCheck: { siteKey: 'site' } }));
    expect(h.providerSiteKeys).toEqual(['site']);
    expect(h.initializeAppCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
    );
  });

  it('skips App Check under the emulators unless a debug token is set', () => {
    withWindow(() =>
      initFirebaseClient(CONFIG, { useEmulators: true, appCheck: { siteKey: 'site' } }),
    );
    expect(h.initializeAppCheck).not.toHaveBeenCalled();
  });

  it('sets the debug token before initializing App Check', () => {
    let tokenAtInit: unknown;
    h.initializeAppCheck.mockImplementationOnce(() => {
      tokenAtInit = (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN;
      return sdk.appCheck;
    });
    withWindow(() =>
      initFirebaseClient(CONFIG, {
        useEmulators: true,
        appCheck: { siteKey: 'site', debugToken: 'debug-uuid' },
      }),
    );
    expect(tokenAtInit).toBe('debug-uuid');
    delete (globalThis as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  it('warns and skips App Check when the site key is missing', () => {
    withWindow(() => initFirebaseClient(CONFIG, { appCheck: {} }));
    expect(h.initializeAppCheck).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('site key is missing'));
  });

  it('initializes App Check once even when the client cache is rebuilt (a hot reload)', () => {
    withWindow(() => {
      initFirebaseClient(CONFIG, { appCheck: { siteKey: 'site' } });
    });
    const flagged = (globalThis as Record<string, unknown>).__APP_CHECK_INITIALIZED__;
    expect(flagged).toBe(true);
  });

  it('waits for the first App Check token once, however often it is awaited', async () => {
    let client: ReturnType<typeof initFirebaseClient> | undefined;
    withWindow(() => {
      client = initFirebaseClient(CONFIG, { appCheck: { siteKey: 'site' } });
    });
    await Promise.all([client!.whenAppCheckReady(), client!.whenAppCheckReady()]);
    expect(h.getToken).toHaveBeenCalledTimes(1);
    expect(h.getToken).toHaveBeenCalledWith(sdk.appCheck, false);
  });

  it('resolves the App Check wait at once when App Check is off', async () => {
    const client = initFirebaseClient(CONFIG);
    await expect(client.whenAppCheckReady()).resolves.toBeUndefined();
    expect(h.getToken).not.toHaveBeenCalled();
  });
});

describe('initFirebaseClient — Auth boot lookup guard', () => {
  it('installs the guard before Auth starts', () => {
    withWindow(() => initFirebaseClient(CONFIG, { authBootLookupGuard: true }));
    expect(h.order).toEqual(['guard', 'getAuth']);
  });

  it('refreshes the App Check token with a forced mint when the guard asks', async () => {
    withWindow(() =>
      initFirebaseClient(CONFIG, { authBootLookupGuard: true, appCheck: { siteKey: 'site' } }),
    );
    const refreshAttestation = h.installAuthBootLookupGuard.mock.calls[0]?.[0]?.refreshAttestation;
    if (!refreshAttestation) throw new Error('the guard was installed with no attestation refresh');
    h.getToken.mockRejectedValueOnce(new Error('throttled'));
    await expect(refreshAttestation()).resolves.toBeUndefined();
    expect(h.getToken).toHaveBeenCalledWith(sdk.appCheck, true);
  });

  it('installs no guard unless asked', () => {
    withWindow(() => initFirebaseClient(CONFIG));
    expect(h.installAuthBootLookupGuard).not.toHaveBeenCalled();
  });
});

describe('initFirebaseClient — Analytics handle', () => {
  it('creates nothing until enabled, then initializes once with the app config', () => {
    let client: ReturnType<typeof initFirebaseClient> | undefined;
    withWindow(() => {
      client = initFirebaseClient(CONFIG, { analyticsConfig: { send_page_view: false } });
      expect(client.analytics.get()).toBeUndefined();
      client.analytics.enable();
      client.analytics.enable();
    });
    expect(h.initializeAnalytics).toHaveBeenCalledTimes(1);
    expect(h.initializeAnalytics).toHaveBeenCalledWith(expect.anything(), {
      config: { send_page_view: false },
    });
    expect(h.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(sdk.analytics, true);
    expect(client!.analytics.get()).toBe(sdk.analytics);
  });

  it('tells subscribers once, when the handle is first created', () => {
    const listener = vi.fn();
    withWindow(() => {
      const { analytics } = initFirebaseClient(CONFIG);
      analytics.subscribe(listener);
      analytics.enable();
      analytics.enable();
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stopping collection before Analytics exists creates nothing', () => {
    withWindow(() => initFirebaseClient(CONFIG).analytics.setCollectionEnabled(false));
    expect(h.initializeAnalytics).not.toHaveBeenCalled();
    expect(h.setAnalyticsCollectionEnabled).not.toHaveBeenCalled();
  });

  it('stops collection on a created handle', () => {
    withWindow(() => {
      const { analytics } = initFirebaseClient(CONFIG);
      analytics.enable();
      analytics.setCollectionEnabled(false);
    });
    expect(h.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(sdk.analytics, false);
  });

  it('creates no Analytics on the server', () => {
    const client = initFirebaseClient(CONFIG);
    expect(client.analytics.enable()).toBeUndefined();
    expect(h.initializeAnalytics).not.toHaveBeenCalled();
  });
});

describe('getFirebaseClient', () => {
  it('throws before the client is initialized', () => {
    expect(() => getFirebaseClient()).toThrow('Firebase client is not initialized');
  });

  it('returns the initialized handles', () => {
    const client = initFirebaseClient(CONFIG);
    expect(getFirebaseClient()).toBe(client);
  });
});
