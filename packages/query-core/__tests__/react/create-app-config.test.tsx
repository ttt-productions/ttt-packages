import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { FirestoreProvider } from '../../src/react/firestore/context.js';
import {
  APP_CONFIG_BACKGROUND_RETRY_MS,
  APP_CONFIG_MAX_QUICK_ATTEMPTS,
  createAppConfig,
  type StoredAppConfig,
} from '../../src/react/app-config/create-app-config.js';

type Levers = { appVersion: string; maintenanceMode: boolean };
type Extra = { noticeRead: string | null };

const PATH = 'config/app';
const DEFAULTS: Levers = { appVersion: '', maintenanceMode: false };
const VALID: Levers = { appVersion: '3.1.0', maintenanceMode: true };

const reports = {
  unavailable: vi.fn<(error: unknown, attempts: number) => void>(),
  unreadable: vi.fn<(error: unknown) => void>(),
};

function readLever<K extends keyof Levers>(
  stored: StoredAppConfig,
  lever: K,
  kind: 'string' | 'boolean',
): Levers[K] {
  const value = stored[lever];
  if (value === undefined) return DEFAULTS[lever];
  if (typeof value !== kind) throw new Error(`${lever} does not match its schema`);
  return value as Levers[K];
}

const config = createAppConfig<Levers, Extra>({
  path: PATH,
  defaults: DEFAULTS,
  readLevers: (stored) => ({
    appVersion: readLever(stored, 'appVersion', 'string'),
    maintenanceMode: readLever(stored, 'maintenanceMode', 'boolean'),
  }),
  extra: {
    read: (stored) => ({ noticeRead: typeof stored?.notice === 'string' ? stored.notice : 'none' }),
    whileUnknown: { noticeRead: null },
  },
  onUnavailable: reports.unavailable,
  onUnreadable: reports.unreadable,
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <FirestoreProvider db={store.db}>
      <config.AppConfigProvider>{children}</config.AppConfigProvider>
    </FirestoreProvider>
  );
}

const renderConfig = () => renderHook(() => config.useAppConfig(), { wrapper: Wrapper });

async function emit(stored: StoredAppConfig | null) {
  if (stored === null) store.remove(PATH);
  else store.seed(PATH, stored);
  await act(async () => {});
}

const listenerStarts = () => store.queries().filter((read) => read.listen).length;

const unavailable = () => firestoreError('unavailable', 'gone');

beforeEach(() => {
  store.reset();
  reports.unavailable.mockReset();
  reports.unreadable.mockReset();
});

describe('createAppConfig — what the listener says', () => {
  it('is loading, on the defaults and the unknown extra, until the first snapshot', () => {
    const { result } = renderConfig();
    expect(result.current).toMatchObject({
      status: 'loading',
      levers: DEFAULTS,
      noticeRead: null,
      retrying: false,
    });
  });

  it('a valid document is ready, as stored, with its extra read from it', async () => {
    const { result } = renderConfig();
    await emit({ ...VALID, notice: 'hello' });
    expect(result.current).toMatchObject({
      status: 'ready',
      levers: VALID,
      noticeRead: 'hello',
    });
  });

  it('a missing document is missing, on the defaults, with its extra read from nothing', async () => {
    const { result } = renderConfig();
    await emit(null);
    expect(result.current).toMatchObject({
      status: 'missing',
      levers: DEFAULTS,
      noticeRead: 'none',
    });
  });

  it('reads the snapshot outside a provider the same way', () => {
    expect(config.readAppConfigSnapshot(null)).toEqual({
      status: 'missing',
      levers: DEFAULTS,
      noticeRead: 'none',
    });
    expect(config.LOADING_APP_CONFIG.status).toBe('loading');
    expect(config.UNAVAILABLE_APP_CONFIG).toMatchObject({
      status: 'unavailable',
      noticeRead: null,
    });
  });
});

describe('createAppConfig — a listener that keeps failing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function failLadder() {
    for (let attempt = 1; attempt < APP_CONFIG_MAX_QUICK_ATTEMPTS; attempt += 1) {
      await act(async () => {});
      act(() => {
        vi.runOnlyPendingTimers();
      });
    }
    await act(async () => {});
  }

  it('is unavailable after its quick retries, reported once, and Try again restarts it', async () => {
    store.failReads(() => true, firestoreError('permission-denied', 'Missing permissions.'));
    const { result } = renderConfig();
    await failLadder();
    expect(result.current).toMatchObject({
      status: 'unavailable',
      levers: DEFAULTS,
      noticeRead: null,
      retrying: false,
    });
    expect(reports.unavailable).toHaveBeenCalledTimes(1);
    expect(reports.unavailable.mock.calls[0]![1]).toBe(APP_CONFIG_MAX_QUICK_ATTEMPTS);

    store.reset();
    store.seed(PATH, VALID);
    const before = listenerStarts();
    act(() => result.current.retry());
    expect(result.current.retrying).toBe(true);
    expect(result.current.status).toBe('unavailable');
    expect(listenerStarts()).toBe(before + 1);
    await act(async () => {});
    expect(result.current).toMatchObject({ status: 'ready', levers: VALID, retrying: false });
  });

  it('a Try again that fails its whole ladder again stops retrying and stays unavailable', async () => {
    store.failReads(() => true, unavailable());
    const { result } = renderConfig();
    await failLadder();
    act(() => result.current.retry());
    expect(result.current.retrying).toBe(true);
    await failLadder();
    expect(result.current).toMatchObject({ status: 'unavailable', retrying: false });
  });

  it('keeps trying about once a minute, quietly, until a changed config arrives, and stops on unmount', async () => {
    const { result, unmount } = renderConfig();
    await emit(VALID);
    store.failReads(() => true, unavailable());
    await act(async () => {
      store.failListeners(() => true, unavailable());
    });
    for (let attempt = 1; attempt < APP_CONFIG_MAX_QUICK_ATTEMPTS; attempt += 1) {
      act(() => {
        vi.runOnlyPendingTimers();
      });
      await act(async () => {});
    }
    expect(reports.unavailable).toHaveBeenCalledTimes(1);

    for (let minute = 1; minute <= 2; minute += 1) {
      const before = listenerStarts();
      act(() => {
        vi.advanceTimersByTime(APP_CONFIG_BACKGROUND_RETRY_MS - 1_000);
      });
      expect(listenerStarts()).toBe(before);
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(listenerStarts()).toBe(before + 1);
      await act(async () => {});
    }
    expect(reports.unavailable).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ status: 'ready', levers: VALID });

    store.reset();
    store.seed(PATH, { ...VALID, appVersion: '9.9.9' });
    act(() => {
      vi.advanceTimersByTime(APP_CONFIG_BACKGROUND_RETRY_MS);
    });
    await act(async () => {});
    expect(result.current.levers.appVersion).toBe('9.9.9');

    await act(async () => {
      store.failListeners(() => true, unavailable());
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('createAppConfig — a stored document is read as it is', () => {
  it('a lever that is absent reads as its default', async () => {
    const { result } = renderConfig();
    await emit({ appVersion: '1.0.0' });
    expect(result.current.levers).toEqual({ appVersion: '1.0.0', maintenanceMode: false });
  });

  it('a lever its reader refuses makes the config unavailable and is reported, never read as a default', async () => {
    const { result } = renderConfig();
    await emit({ ...VALID, maintenanceMode: 'true' });
    expect(result.current.status).toBe('unavailable');
    expect(reports.unreadable).toHaveBeenCalledTimes(1);
    expect(reports.unreadable).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'maintenanceMode does not match its schema' }),
    );
  });

  it('reads again once the document is corrected', async () => {
    const { result } = renderConfig();
    await emit({ ...VALID, appVersion: 42 });
    expect(result.current.status).toBe('unavailable');
    await emit(VALID);
    expect(result.current).toMatchObject({ status: 'ready', levers: VALID });
  });

  it('a valid document reports nothing', async () => {
    renderConfig();
    await emit(VALID);
    await emit(null);
    expect(reports.unreadable).not.toHaveBeenCalled();
  });
});
