import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('@ttt-productions/firebase-helpers', () => ({
  now: vi.fn(() => Date.now()),
}));

// Must use dynamic imports + resetModules to get fresh module state per test
// since upload-store has module-level Map singletons

describe('upload-store', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Re-mock after resetModules
    vi.mock('@ttt-productions/firebase-helpers', () => ({
      now: vi.fn(() => Date.now()),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getStore() {
    const mod = await import('../src/utils/upload-store');
    return mod;
  }

  it('upsertUploadSession creates a new session', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'session-1', status: 'idle', path: 'uploads/file.jpg' });
    const session = store.getUploadSession('session-1');
    expect(session).toBeDefined();
    expect(session?.id).toBe('session-1');
    expect(session?.status).toBe('idle');
    expect(session?.path).toBe('uploads/file.jpg');
  });

  it('getUploadSession returns undefined for unknown id', async () => {
    const store = await getStore();
    expect(store.getUploadSession('nonexistent')).toBeUndefined();
  });

  it('listUploadSessions returns all sessions sorted by updatedAt descending', async () => {
    const store = await getStore();
    const { now } = await import('@ttt-productions/firebase-helpers');
    const nowMock = now as ReturnType<typeof vi.fn>;

    nowMock.mockReturnValue(1000);
    store.upsertUploadSession({ id: 'a', status: 'idle', path: 'a', updatedAt: 1000 });
    nowMock.mockReturnValue(3000);
    store.upsertUploadSession({ id: 'b', status: 'idle', path: 'b', updatedAt: 3000 });
    nowMock.mockReturnValue(2000);
    store.upsertUploadSession({ id: 'c', status: 'idle', path: 'c', updatedAt: 2000 });

    const sessions = store.listUploadSessions();
    expect(sessions.map(s => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('removeUploadSession deletes a session', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'to-remove', status: 'idle', path: '' });
    store.removeUploadSession('to-remove');
    expect(store.getUploadSession('to-remove')).toBeUndefined();
  });

  it('progress values never go backwards', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'prog', status: 'uploading', path: '', transferred: 500, total: 1000, percent: 50 });
    // Try to lower progress
    store.upsertUploadSession({ id: 'prog', transferred: 100, total: 1000, percent: 10 });
    const session = store.getUploadSession('prog');
    expect(session?.transferred).toBe(500);
    expect(session?.percent).toBe(50);
  });

  it('progress increases normally', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'prog2', status: 'uploading', path: '', transferred: 200, total: 1000, percent: 20 });
    store.upsertUploadSession({ id: 'prog2', transferred: 700, total: 1000, percent: 70 });
    const session = store.getUploadSession('prog2');
    expect(session?.transferred).toBe(700);
    expect(session?.percent).toBe(70);
  });

  it('terminal status is sticky (success)', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'terminal', status: 'success', path: '' });
    store.upsertUploadSession({ id: 'terminal', status: 'uploading' });
    expect(store.getUploadSession('terminal')?.status).toBe('success');
  });

  it('terminal status is sticky (error)', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'err', status: 'error', path: '' });
    store.upsertUploadSession({ id: 'err', status: 'idle' });
    expect(store.getUploadSession('err')?.status).toBe('error');
  });

  it('terminal status is sticky (canceled)', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'can', status: 'canceled', path: '' });
    store.upsertUploadSession({ id: 'can', status: 'queued' });
    expect(store.getUploadSession('can')?.status).toBe('canceled');
  });

  it('out-of-order updates rejected by updatedAt guard', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'order', status: 'uploading', path: '', percent: 50, updatedAt: 2000 });
    // Earlier update
    store.upsertUploadSession({ id: 'order', status: 'idle', percent: 10, updatedAt: 1000 });
    expect(store.getUploadSession('order')?.status).toBe('uploading');
    expect(store.getUploadSession('order')?.percent).toBe(50);
  });

  it('subscribeUploadSession fires callback immediately with current state', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'sub', status: 'idle', path: '' });
    const cb = vi.fn();
    const unsub = store.subscribeUploadSession('sub', cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].id).toBe('sub');
    unsub();
  });

  it('subscribeUploadSession fires callback on update', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'sub2', status: 'idle', path: '' });
    const cb = vi.fn();
    const unsub = store.subscribeUploadSession('sub2', cb);
    cb.mockClear();
    store.upsertUploadSession({ id: 'sub2', status: 'uploading' });
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('unsubscribe stops receiving updates', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'unsub', status: 'idle', path: '' });
    const cb = vi.fn();
    const unsub = store.subscribeUploadSession('unsub', cb);
    unsub();
    cb.mockClear();
    store.upsertUploadSession({ id: 'unsub', status: 'uploading' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('subscribeUploadSessionsList fires on new session added', async () => {
    const store = await getStore();
    const cb = vi.fn();
    const unsub = store.subscribeUploadSessionsList(cb);
    store.upsertUploadSession({ id: 'new-session', status: 'idle', path: '' });
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('subscribeUploadSessionsList fires on session removed', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'remove-me', status: 'idle', path: '' });
    const cb = vi.fn();
    const unsub = store.subscribeUploadSessionsList(cb);
    cb.mockClear();
    store.removeUploadSession('remove-me');
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('version increments on each upsert', async () => {
    const store = await getStore();
    store.upsertUploadSession({ id: 'ver', status: 'idle', path: '' });
    const v1 = store.getUploadSession('ver')?.version ?? 0;
    store.upsertUploadSession({ id: 'ver', status: 'uploading' });
    const v2 = store.getUploadSession('ver')?.version ?? 0;
    expect(v2).toBeGreaterThan(v1);
  });

  describe('pruneOldUploadSessions', () => {
    it('prunes expired success sessions (>24h)', async () => {
      const store = await getStore();
      const { now } = await import('@ttt-productions/firebase-helpers');
      const nowMock = now as ReturnType<typeof vi.fn>;

      const pastTime = Date.now() - (25 * 60 * 60 * 1000); // 25h ago
      store.upsertUploadSession({ id: 'old-success', status: 'success', path: '', updatedAt: pastTime });
      nowMock.mockReturnValue(Date.now());
      const pruned = store.pruneOldUploadSessions();
      expect(pruned).toBeGreaterThanOrEqual(1);
      expect(store.getUploadSession('old-success')).toBeUndefined();
    });

    it('keeps fresh success sessions (<24h)', async () => {
      const store = await getStore();
      const { now } = await import('@ttt-productions/firebase-helpers');
      const nowMock = now as ReturnType<typeof vi.fn>;
      const recentTime = Date.now() - (1 * 60 * 60 * 1000); // 1h ago
      store.upsertUploadSession({ id: 'fresh-success', status: 'success', path: '', updatedAt: recentTime });
      nowMock.mockReturnValue(Date.now());
      store.pruneOldUploadSessions();
      expect(store.getUploadSession('fresh-success')).toBeDefined();
    });

    it('prunes expired error sessions (>7d)', async () => {
      const store = await getStore();
      const { now } = await import('@ttt-productions/firebase-helpers');
      const nowMock = now as ReturnType<typeof vi.fn>;
      const pastTime = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      store.upsertUploadSession({ id: 'old-error', status: 'error', path: '', updatedAt: pastTime });
      nowMock.mockReturnValue(Date.now());
      const pruned = store.pruneOldUploadSessions();
      expect(pruned).toBeGreaterThanOrEqual(1);
      expect(store.getUploadSession('old-error')).toBeUndefined();
    });

    it('returns count of pruned sessions', async () => {
      const store = await getStore();
      const { now } = await import('@ttt-productions/firebase-helpers');
      const nowMock = now as ReturnType<typeof vi.fn>;
      const pastTime = Date.now() - (25 * 60 * 60 * 1000);
      store.upsertUploadSession({ id: 'p1', status: 'success', path: '', updatedAt: pastTime });
      store.upsertUploadSession({ id: 'p2', status: 'success', path: '', updatedAt: pastTime });
      nowMock.mockReturnValue(Date.now());
      const pruned = store.pruneOldUploadSessions();
      expect(pruned).toBe(2);
    });
  });
});
