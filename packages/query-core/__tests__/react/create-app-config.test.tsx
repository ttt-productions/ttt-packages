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

const accepts: Record<keyof Levers, (value: unknown) => boolean> = {
  appVersion: (value) => typeof value === 'string',
  maintenanceMode: (value) => typeof value === 'boolean',
};

const reports = {
  refused: vi.fn<(lever: keyof Levers, value: unknown) => void>(),
  unavailable: vi.fn<(error: unknown, attempts: number) => void>(),
};

const config = createAppConfig<Levers, Extra>({
  path: PATH,
  defaults: DEFAULTS,
  readLevers: (stored) => ({
    appVersion: typeof stored.appVersion === 'string' ? stored.appVersion : DEFAULTS.appVersion,
    maintenanceMode:
      typeof stored.maintenanceMode === 'boolean'
        ? stored.maintenanceMode
        : DEFAULTS.maintenanceMode,
  }),
  isLeverRefused: (stored, lever) => stored[lever] !== undefined && !accepts[lever](stored[lever]),
  extra: {
    read: (stored) => ({ noticeRead: typeof stored?.notice === 'string' ? stored.notice : 'none' }),
    whileUnknown: { noticeRead: null },
  },
  onLeverRefused: reports.refused,
  onUnavailable: reports.unavailable,
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
  reports.refused.mockReset();
  reports.unavailable.mockReset();
});

describe('createAppConfig — what the listener says', () => {
  it('is loading, on the defaults and the unknown extra, until the first snapshot', () => {
    const { result } = renderConfig();
    expect(result.current).toMatchObject({
      status: 'loading',
      levers: DEFAULTS,
      refusedLevers: [],
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
      refusedLevers: [],
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
      refusedLevers: [],
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

describe('createAppConfig — every snapshot is read lever by lever', () => {
  it('a refused lever reads as its default and is named, and the valid lever survives', async () => {
    const { result } = renderConfig();
    await emit({ ...VALID, maintenanceMode: 'true' });
    expect(result.current.levers).toEqual({ ...VALID, maintenanceMode: false });
    expect(result.current.refusedLevers).toEqual(['maintenanceMode']);
  });

  it('an absent lever is not refused; it reads as its default', async () => {
    const { result } = renderConfig();
    await emit({ appVersion: '1.0.0' });
    expect(result.current.levers).toEqual({ appVersion: '1.0.0', maintenanceMode: false });
    expect(result.current.refusedLevers).toEqual([]);
  });

  it('reports a refused lever once per distinct field and value', async () => {
    renderConfig();
    await emit({ ...VALID, appVersion: 42 });
    await emit({ ...VALID, appVersion: 42 });
    expect(reports.refused).toHaveBeenCalledTimes(1);
    expect(reports.refused).toHaveBeenCalledWith('appVersion', 42);
    await emit({ ...VALID, appVersion: 43 });
    expect(reports.refused).toHaveBeenCalledTimes(2);
    await emit({ ...VALID, appVersion: 43, maintenanceMode: 'true' });
    expect(reports.refused).toHaveBeenCalledTimes(3);
    expect(reports.refused).toHaveBeenLastCalledWith('maintenanceMode', 'true');
  });

  it('a valid document reports nothing', async () => {
    renderConfig();
    await emit(VALID);
    await emit(null);
    expect(reports.refused).not.toHaveBeenCalled();
  });
});
