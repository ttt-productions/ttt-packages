// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';

const guard = vi.hoisted(() => ({
  failureClass: null as
    import('../src/client/auth-boot-lookup-guard.js').BootLookupFailureClass | null,
}));

vi.mock(import('../src/client/auth-boot-lookup-guard.js'), async (importOriginal) => {
  const { passThroughModule } = await import('@ttt-productions/dev-standards/testing');
  return passThroughModule(importOriginal, {
    getLastBootLookupFailureClass: () => guard.failureClass,
  });
});

import { AuthBootPurgeSentinel } from '../src/react/auth-boot-purge-sentinel.js';
import { peekPersistedAuthUser } from '../src/client/persisted-auth-peek.js';

const flush = () => act(async () => {});

beforeEach(() => {
  guard.failureClass = null;
});

describe('AuthBootPurgeSentinel', () => {
  it('reports once when a persisted session resolves signed out at the first resolution', async () => {
    const onPurged = vi.fn();
    const peek = async () => ({ existed: true, uid: 'u1' });
    const { rerender } = render(
      <AuthBootPurgeSentinel loading signedIn={false} onPurged={onPurged} peek={peek} />,
    );
    await flush();
    expect(onPurged).not.toHaveBeenCalled();

    rerender(
      <AuthBootPurgeSentinel loading={false} signedIn={false} onPurged={onPurged} peek={peek} />,
    );
    await flush();
    expect(onPurged).toHaveBeenCalledTimes(1);
    expect(onPurged).toHaveBeenCalledWith({ persistedUid: 'u1', failureClass: null });

    rerender(<AuthBootPurgeSentinel loading={false} signedIn onPurged={onPurged} peek={peek} />);
    rerender(
      <AuthBootPurgeSentinel loading={false} signedIn={false} onPurged={onPurged} peek={peek} />,
    );
    await flush();
    expect(onPurged).toHaveBeenCalledTimes(1);
  });

  it('reports nothing when the persisted session resolves signed in', async () => {
    const onPurged = vi.fn();
    render(
      <AuthBootPurgeSentinel
        loading={false}
        signedIn
        onPurged={onPurged}
        peek={async () => ({ existed: true, uid: 'u1' })}
      />,
    );
    await flush();
    expect(onPurged).not.toHaveBeenCalled();
  });

  it('reports nothing when no session was persisted at boot', async () => {
    const onPurged = vi.fn();
    render(
      <AuthBootPurgeSentinel
        loading={false}
        signedIn={false}
        onPurged={onPurged}
        peek={async () => ({ existed: false })}
      />,
    );
    await flush();
    expect(onPurged).not.toHaveBeenCalled();
  });

  it('reports the boot lookup failure class that caused the purge', async () => {
    guard.failureClass = 'identity';
    const onPurged = vi.fn();
    render(
      <AuthBootPurgeSentinel
        loading={false}
        signedIn={false}
        onPurged={onPurged}
        peek={async () => ({ existed: true, uid: 'u2' })}
      />,
    );
    await flush();
    expect(onPurged).toHaveBeenCalledWith({ persistedUid: 'u2', failureClass: 'identity' });
  });
});

type AuthRow = { fbase_key?: string; value?: { uid?: string } };
type DatabaseState = 'absent' | 'no-store' | { rows: AuthRow[] } | 'open-fails';

function installIndexedDb(state: DatabaseState) {
  const created: string[] = [];
  const aborted = vi.fn();
  const closed = vi.fn();
  vi.stubGlobal('indexedDB', {
    open: (name: string) => {
      const request: Record<string, unknown> = {};
      queueMicrotask(() => {
        if (state === 'open-fails') {
          (request.onerror as () => void)();
          return;
        }
        if (state === 'absent') {
          created.push(name);
          request.transaction = { abort: aborted };
          (request.onupgradeneeded as () => void)();
          return;
        }
        request.result = {
          close: closed,
          objectStoreNames: { contains: () => state !== 'no-store' },
          transaction: () => ({
            objectStore: () => ({
              getAll: () => {
                const getAll: Record<string, unknown> = {};
                queueMicrotask(() => {
                  getAll.result = typeof state === 'object' ? state.rows : [];
                  (getAll.onsuccess as () => void)();
                });
                return getAll;
              },
            }),
          }),
        };
        (request.onsuccess as () => void)();
      });
      return request;
    },
  });
  return { created, aborted, closed };
}

describe('peekPersistedAuthUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds the persisted Auth user and its uid', async () => {
    const db = installIndexedDb({
      rows: [
        { fbase_key: 'other' },
        { fbase_key: 'firebase:authUser:key:[DEFAULT]', value: { uid: 'u9' } },
      ],
    });
    await expect(peekPersistedAuthUser()).resolves.toEqual({ existed: true, uid: 'u9' });
    expect(db.closed).toHaveBeenCalled();
  });

  it('aborts instead of creating the Auth database when it does not exist', async () => {
    const db = installIndexedDb('absent');
    await expect(peekPersistedAuthUser()).resolves.toEqual({ existed: false });
    expect(db.aborted).toHaveBeenCalledTimes(1);
  });

  it('finds nothing when the database holds no Auth store or no Auth user', async () => {
    installIndexedDb('no-store');
    await expect(peekPersistedAuthUser()).resolves.toEqual({ existed: false });
    installIndexedDb({ rows: [{ fbase_key: 'firebase:heartbeat' }] });
    await expect(peekPersistedAuthUser()).resolves.toEqual({ existed: false });
  });

  it('finds nothing when the database cannot be opened or IndexedDB is missing', async () => {
    installIndexedDb('open-fails');
    await expect(peekPersistedAuthUser()).resolves.toEqual({ existed: false });
    vi.stubGlobal('indexedDB', undefined);
    await expect(peekPersistedAuthUser()).resolves.toEqual({ existed: false });
  });
});
