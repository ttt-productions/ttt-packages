import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  order: [] as string[],
  initializeAppCheck: vi.fn(() => ({ kind: 'appCheck' })),
  getToken: vi.fn(async () => ({ token: 't' })),
  ReCaptchaEnterpriseProvider: vi.fn(),
  initializeAnalytics: vi.fn(() => ({ kind: 'analytics' })),
  setAnalyticsCollectionEnabled: vi.fn(),
  installAuthBootLookupGuard: vi.fn(),
  initializeFirestore: vi.fn(() => ({ kind: 'persistent-db' })),
  getFirestore: vi.fn(() => ({ kind: 'db' })),
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: h.initializeAppCheck,
  getToken: h.getToken,
  ReCaptchaEnterpriseProvider: h.ReCaptchaEnterpriseProvider,
}));
vi.mock('firebase/analytics', () => ({
  initializeAnalytics: h.initializeAnalytics,
  setAnalyticsCollectionEnabled: h.setAnalyticsCollectionEnabled,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: h.getFirestore,
  initializeFirestore: h.initializeFirestore,
  persistentLocalCache: vi.fn(() => ({ kind: 'cache' })),
  persistentMultipleTabManager: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => {
    h.order.push('getAuth');
    return { kind: 'auth' };
  }),
  connectAuthEmulator: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: {},
}));
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({ kind: 'storage' })),
  connectStorageEmulator: vi.fn(),
}));
vi.mock('../src/client/auth-boot-lookup-guard.js', () => ({
  installAuthBootLookupGuard: (...args: unknown[]) => {
    h.order.push('guard');
    h.installAuthBootLookupGuard(...args);
  },
}));

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
  vi.clearAllMocks();
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
    expect(connectStorageEmulator).toHaveBeenCalledWith({ kind: 'storage' }, 'localhost', 4);
  });
});

describe('initFirebaseClient — Firestore cache', () => {
  it('uses the multi-tab persistent cache in the browser when asked', () => {
    let db: unknown;
    withWindow(() => {
      db = initFirebaseClient(CONFIG, { persistentFirestoreCache: true }).db;
    });
    expect(db).toEqual({ kind: 'persistent-db' });
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
    expect(db).toEqual({ kind: 'db' });
  });
});

describe('initFirebaseClient — App Check', () => {
  it('initializes App Check with the reCAPTCHA Enterprise provider and auto-refresh', () => {
    withWindow(() => initFirebaseClient(CONFIG, { appCheck: { siteKey: 'site' } }));
    expect(h.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('site');
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
      return { kind: 'appCheck' };
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
    expect(h.getToken).toHaveBeenCalledWith({ kind: 'appCheck' }, false);
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
    const [{ refreshAttestation }] = h.installAuthBootLookupGuard.mock.calls[0] as [
      { refreshAttestation: () => Promise<void> },
    ];
    h.getToken.mockRejectedValueOnce(new Error('throttled'));
    await expect(refreshAttestation()).resolves.toBeUndefined();
    expect(h.getToken).toHaveBeenCalledWith({ kind: 'appCheck' }, true);
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
    expect(h.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({ kind: 'analytics' }, true);
    expect(client!.analytics.get()).toEqual({ kind: 'analytics' });
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
    expect(h.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith({ kind: 'analytics' }, false);
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
