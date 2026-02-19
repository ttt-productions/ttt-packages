import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalStorageUploadSessionPersistence } from '../src/persistence/localstorage';
import type { UploadSessionState } from '../src/types';

function makeSession(id: string, overrides: Partial<UploadSessionState> = {}): UploadSessionState {
  return {
    id,
    status: 'idle',
    path: 'uploads/test.jpg',
    version: 1,
    transferred: 0,
    total: 1000,
    percent: 0,
    startedAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('createLocalStorageUploadSessionPersistence', () => {
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockStorage = new Map();

    // Mock window.localStorage
    const localStorageMock = {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => { mockStorage.set(key, value); },
      removeItem: (key: string) => { mockStorage.delete(key); },
      get length() { return mockStorage.size; },
      key: (index: number) => Array.from(mockStorage.keys())[index] ?? null,
      clear: () => mockStorage.clear(),
    };

    Object.defineProperty(global, 'window', {
      value: { localStorage: localStorageMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listIds returns empty array when no sessions stored', () => {
    const adapter = createLocalStorageUploadSessionPersistence();
    expect(adapter.listIds()).toEqual([]);
  });

  it('set stores a session', () => {
    const adapter = createLocalStorageUploadSessionPersistence();
    const session = makeSession('abc');
    adapter.set('abc', session);
    expect(mockStorage.has('ttt_upload_session:abc')).toBe(true);
  });

  it('get retrieves a stored session', () => {
    const adapter = createLocalStorageUploadSessionPersistence();
    const session = makeSession('abc');
    adapter.set('abc', session);
    const retrieved = adapter.get('abc');
    expect(retrieved).toEqual(session);
  });

  it('get returns null for missing session', () => {
    const adapter = createLocalStorageUploadSessionPersistence();
    expect(adapter.get('nonexistent')).toBeNull();
  });

  it('listIds returns only prefixed keys', () => {
    const adapter = createLocalStorageUploadSessionPersistence();
    mockStorage.set('ttt_upload_session:id1', JSON.stringify(makeSession('id1')));
    mockStorage.set('ttt_upload_session:id2', JSON.stringify(makeSession('id2')));
    mockStorage.set('other_key', 'other_value');
    const ids = adapter.listIds() as string[];
    expect(ids).toContain('id1');
    expect(ids).toContain('id2');
    expect(ids).not.toContain('other_key');
  });

  it('remove deletes a session', () => {
    const adapter = createLocalStorageUploadSessionPersistence();
    const session = makeSession('to-remove');
    adapter.set('to-remove', session);
    adapter.remove('to-remove');
    expect(adapter.get('to-remove')).toBeNull();
    expect(mockStorage.has('ttt_upload_session:to-remove')).toBe(false);
  });

  it('get returns null for corrupted JSON', () => {
    const adapter = createLocalStorageUploadSessionPersistence();
    mockStorage.set('ttt_upload_session:corrupt', 'not-valid-json{{{');
    expect(adapter.get('corrupt')).toBeNull();
  });

  it('custom prefix works', () => {
    const adapter = createLocalStorageUploadSessionPersistence({ prefix: 'custom:' });
    const session = makeSession('s1');
    adapter.set('s1', session);
    expect(mockStorage.has('custom:s1')).toBe(true);
  });

  it('custom prefix listIds returns only custom-prefixed keys', () => {
    const adapter1 = createLocalStorageUploadSessionPersistence({ prefix: 'app1:' });
    const adapter2 = createLocalStorageUploadSessionPersistence({ prefix: 'app2:' });
    adapter1.set('x', makeSession('x'));
    adapter2.set('y', makeSession('y'));
    const ids1 = adapter1.listIds() as string[];
    const ids2 = adapter2.listIds() as string[];
    expect(ids1).toEqual(['x']);
    expect(ids2).toEqual(['y']);
  });

  describe('graceful fallback when localStorage unavailable', () => {
    beforeEach(() => {
      // Remove window entirely to simulate no localStorage
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });

    it('listIds returns empty array', () => {
      const adapter = createLocalStorageUploadSessionPersistence();
      expect(adapter.listIds()).toEqual([]);
    });

    it('get returns null', () => {
      const adapter = createLocalStorageUploadSessionPersistence();
      expect(adapter.get('anything')).toBeNull();
    });

    it('set does not throw', () => {
      const adapter = createLocalStorageUploadSessionPersistence();
      expect(() => adapter.set('id', makeSession('id'))).not.toThrow();
    });

    it('remove does not throw', () => {
      const adapter = createLocalStorageUploadSessionPersistence();
      expect(() => adapter.remove('id')).not.toThrow();
    });
  });
});
