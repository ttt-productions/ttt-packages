import { describe, it, expect, beforeEach } from 'vitest';
import { initFirebaseClient, __resetFirebaseClientCache } from '../src/client/firebase-init.js';

describe('initFirebaseClient', () => {
  beforeEach(() => {
    __resetFirebaseClientCache();
  });

  it('returns handles with app, db, auth, storage, functions', () => {
    const result = initFirebaseClient({ apiKey: 'test', projectId: 'test-project' });
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
    // After reset, a fresh object is returned
    expect(first).not.toBe(second);
  });

  it('does not connect emulators when useEmulators is false', async () => {
    const { connectAuthEmulator } = await import('firebase/auth');
    initFirebaseClient({ apiKey: 'test' }, { useEmulators: false });
    expect(connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('does not connect emulators when window is undefined (SSR)', async () => {
    const originalWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    try {
      const { connectAuthEmulator } = await import('firebase/auth');
      initFirebaseClient({ apiKey: 'test' }, { useEmulators: true });
      expect(connectAuthEmulator).not.toHaveBeenCalled();
    } finally {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });
});
