import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin', () => {
  const mockApp = {
    firestore: vi.fn(() => ({ _type: 'firestore' })),
    auth: vi.fn(() => ({ _type: 'auth' })),
    storage: vi.fn(() => ({ _type: 'storage' })),
  };

  const mockAdmin = {
    apps: [] as unknown[],
    initializeApp: vi.fn(() => {
      mockAdmin.apps.push(mockApp);
      return mockApp;
    }),
    app: vi.fn(() => mockApp),
    credential: {
      applicationDefault: vi.fn(),
    },
  };

  return { default: mockAdmin };
});

describe('getAdminApp', () => {
  beforeEach(async () => {
    vi.resetModules();
    const adminMod = await import('firebase-admin');
    const admin = (adminMod as { default: { apps: unknown[] } }).default;
    admin.apps.length = 0;
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

  it('is idempotent — returns same handle on second call', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    const first = getAdminApp();
    const second = getAdminApp();
    expect(first.app).toBe(second.app);
  });

  it('calls initializeApp with no argument when no options are provided', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    const adminMod = await import('firebase-admin');
    const admin = (adminMod as unknown as { default: { initializeApp: ReturnType<typeof vi.fn>; apps: unknown[] } }).default;
    admin.apps.length = 0;
    admin.initializeApp.mockClear();
    getAdminApp();
    expect(admin.initializeApp).toHaveBeenCalledWith();
  });

  it('calls initializeApp when apps list is empty', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    const adminMod = await import('firebase-admin');
    const admin = (adminMod as unknown as { default: { initializeApp: ReturnType<typeof vi.fn>; apps: unknown[] } }).default;
    admin.apps.length = 0;
    getAdminApp({ projectId: 'test-project' });
    expect(admin.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'test-project' }),
    );
  });

  it('skips initializeApp when apps list is non-empty', async () => {
    const { getAdminApp } = await import('../src/server/admin-init');
    const adminMod = await import('firebase-admin');
    const admin = (adminMod as unknown as { default: { initializeApp: ReturnType<typeof vi.fn>; apps: unknown[] } }).default;
    admin.apps.push({});
    admin.initializeApp.mockClear();
    getAdminApp();
    expect(admin.initializeApp).not.toHaveBeenCalled();
  });
});
