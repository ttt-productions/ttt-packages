import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockApp = { name: '[DEFAULT]', options: {} };
  const mockDb = { _type: 'firestore' };
  const mockAuth = { _type: 'auth' };
  const mockStorage = { _type: 'storage' };
  const mockAdminRoot = { _type: 'firebase-admin-root' };
  const apps: unknown[] = [];

  return {
    mockApp,
    mockDb,
    mockAuth,
    mockStorage,
    mockAdminRoot,
    apps,
    initializeApp: vi.fn(() => {
      apps.push(mockApp);
      return mockApp;
    }),
    getApps: vi.fn(() => apps),
    // Real SDK semantics: `getApp()` THROWS `app/no-app` when no default app has been
    // initialized. Modelling that is what makes every test below a real guard — a
    // regression that skipped `initializeApp` and called `getApp()` against an empty
    // store would otherwise be handed an app and pass silently.
    getApp: vi.fn(() => {
      if (apps.length === 0) {
        const err = new Error(
          'The default Firebase app does not exist. Make sure you call initializeApp() before using any of the Firebase services.',
        ) as Error & { code: string };
        err.code = 'app/no-app';
        throw err;
      }
      return mockApp;
    }),
    getFirestore: vi.fn(() => mockDb),
    getAuth: vi.fn(() => mockAuth),
    getStorage: vi.fn(() => mockStorage),
  };
});

vi.mock('firebase-admin', () => ({ default: mocks.mockAdminRoot }));
vi.mock('firebase-admin/app', () => ({
  initializeApp: mocks.initializeApp,
  getApps: mocks.getApps,
  getApp: mocks.getApp,
}));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: mocks.getFirestore }));
vi.mock('firebase-admin/auth', () => ({ getAuth: mocks.getAuth }));
vi.mock('firebase-admin/storage', () => ({ getStorage: mocks.getStorage }));

describe('getAdminApp', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.apps.length = 0;
    mocks.initializeApp.mockClear();
    mocks.getApp.mockClear();
    mocks.getFirestore.mockClear();
    mocks.getAuth.mockClear();
    mocks.getStorage.mockClear();
  });

  it('returns app, db, auth, storage, and admin handles', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    const result = getAdminApp();
    expect(result).toHaveProperty('app');
    expect(result).toHaveProperty('db');
    expect(result).toHaveProperty('auth');
    expect(result).toHaveProperty('storage');
    expect(result).toHaveProperty('admin');
  });

  it('derives db/auth/storage from the modular getters bound to the initialized app', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    const result = getAdminApp();
    expect(mocks.getFirestore).toHaveBeenCalledWith(mocks.mockApp);
    expect(mocks.getAuth).toHaveBeenCalledWith(mocks.mockApp);
    expect(mocks.getStorage).toHaveBeenCalledWith(mocks.mockApp);
    expect(result.db).toBe(mocks.mockDb);
    expect(result.auth).toBe(mocks.mockAuth);
    expect(result.storage).toBe(mocks.mockStorage);
  });

  it('exposes the firebase-admin package root as the admin handle', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    expect(getAdminApp().admin).toBe(mocks.mockAdminRoot);
  });

  it('is idempotent — returns same handle on second call', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    const first = getAdminApp();
    const second = getAdminApp();
    expect(first.app).toBe(second.app);
  });

  it('calls initializeApp with no argument when no options are provided', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    getAdminApp();
    expect(mocks.initializeApp).toHaveBeenCalledWith();
  });

  it('calls initializeApp when apps list is empty', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    getAdminApp({ projectId: 'test-project' });
    expect(mocks.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'test-project' }),
    );
  });

  it('the getApp mock models the real SDK failure on an empty app store', () => {
    expect(mocks.apps).toHaveLength(0);
    let caught: unknown;
    try {
      mocks.getApp();
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: string } | undefined)?.code).toBe('app/no-app');
  });

  it('initializes before resolving the default app — never calls getApp against an empty store', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    expect(mocks.apps).toHaveLength(0);
    // getApp throws 'app/no-app' on an empty store, so this only resolves if
    // initializeApp ran first.
    expect(() => getAdminApp()).not.toThrow();
    expect(mocks.initializeApp.mock.invocationCallOrder).toHaveLength(1);
    expect(mocks.getApp.mock.invocationCallOrder).toHaveLength(1);
    expect(mocks.initializeApp.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getApp.mock.invocationCallOrder[0],
    );
  });

  it('skips initializeApp when apps list is non-empty', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    mocks.apps.push({});
    getAdminApp();
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.getApp).toHaveBeenCalled();
  });
});
