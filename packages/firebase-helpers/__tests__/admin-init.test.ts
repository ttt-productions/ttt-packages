import admin from 'firebase-admin';
import type { App, AppOptions } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const registry = vi.hoisted(() => ({
  apps: [] as App[],
  created: 0,
  realGetApp: null as null | (() => App),
}));

vi.mock(import('firebase-admin/app'), async (importOriginal) => {
  const { passThroughModule } = await import('@ttt-productions/dev-standards/testing');
  const actual = await importOriginal();
  registry.realGetApp = () => actual.getApp();
  return passThroughModule(importOriginal, {
    initializeApp: vi.fn((options?: AppOptions) => {
      registry.created += 1;
      const app = actual.initializeApp(
        { projectId: 'demo-admin-init', ...options },
        `admin-init-${registry.created}`,
      );
      registry.apps.push(app);
      return app;
    }),
    getApps: vi.fn(() => registry.apps),
    getApp: vi.fn(() => {
      const [app] = registry.apps;
      if (!app)
        throw Object.assign(
          new Error(
            'The default Firebase app does not exist. Make sure you call initializeApp() before using any of the Firebase services.',
          ),
          { code: 'app/no-app' },
        );
      return app;
    }),
  });
});

import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAdminApp, __resetAdminAppCache } from '../src/server/admin-init.js';

const initializeAppMock = vi.mocked(initializeApp);
const getAppMock = vi.mocked(getApp);

describe('getAdminApp', () => {
  beforeEach(() => {
    __resetAdminAppCache();
    registry.apps.length = 0;
    initializeAppMock.mockClear();
    getAppMock.mockClear();
  });

  it('returns app, db, auth, storage, and admin handles', () => {
    const result = getAdminApp();
    expect(result).toHaveProperty('app');
    expect(result).toHaveProperty('db');
    expect(result).toHaveProperty('auth');
    expect(result).toHaveProperty('storage');
    expect(result).toHaveProperty('admin');
  });

  it('derives db/auth/storage from the modular getters bound to the initialized app', () => {
    const result = getAdminApp();
    const [initialized] = registry.apps;
    expect(result.app).toBe(initialized);
    expect(result.db).toBe(getFirestore(initialized));
    expect(result.auth).toBe(getAuth(initialized));
    expect(result.storage).toBe(getStorage(initialized));
  });

  it('exposes the firebase-admin package root as the admin handle', () => {
    expect(getAdminApp().admin).toBe(admin);
  });

  it('is idempotent — returns same handle on second call', () => {
    const first = getAdminApp();
    const second = getAdminApp();
    expect(first.app).toBe(second.app);
  });

  it('calls initializeApp with no argument when no options are provided', () => {
    getAdminApp();
    expect(initializeAppMock).toHaveBeenCalledWith();
  });

  it('calls initializeApp when apps list is empty', () => {
    getAdminApp({ projectId: 'test-project' });
    expect(initializeAppMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'test-project' }),
    );
  });

  it('the getApp stand-in fails on an empty app store with the code the real SDK throws', () => {
    const codeOf = (read: () => App): unknown => {
      try {
        read();
      } catch (error) {
        return Reflect.get(Object(error), 'code');
      }
      return 'no failure';
    };
    expect(getApps()).toHaveLength(0);
    expect(codeOf(registry.realGetApp!)).toBe('app/no-app');
    expect(codeOf(getApp)).toBe(codeOf(registry.realGetApp!));
  });

  it('initializes before resolving the default app — never calls getApp against an empty store', () => {
    expect(getApps()).toHaveLength(0);
    expect(() => getAdminApp()).not.toThrow();
    expect(initializeAppMock.mock.invocationCallOrder).toHaveLength(1);
    expect(getAppMock.mock.invocationCallOrder).toHaveLength(1);
    expect(initializeAppMock.mock.invocationCallOrder[0]).toBeLessThan(
      getAppMock.mock.invocationCallOrder[0],
    );
  });

  it('skips initializeApp when apps list is non-empty', () => {
    initializeApp({ projectId: 'demo-admin-init' });
    initializeAppMock.mockClear();
    getAdminApp();
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getAppMock).toHaveBeenCalled();
  });
});
