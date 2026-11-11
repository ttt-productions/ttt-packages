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

type Levers = { appVersion: string; message: string };

const PATH = 'config/app';
const VALID: Levers = { appVersion: '3.1.0', message: 'Back at nine.' };

const reports = {
  unavailable: vi.fn<(error: unknown, attempts: number) => void>(),
  invalid: vi.fn<(error: unknown) => void>(),
};

function readSetting(stored: StoredAppConfig, setting: keyof Levers): string {
  const value = stored[setting];
  if (typeof value !== 'string') throw new Error(`${setting} is missing or does not match`);
  return value;
}

function readLevers(stored: StoredAppConfig | null): Levers {
  if (stored === null) throw new Error('the document does not exist');
  return { appVersion: readSetting(stored, 'appVersion'), message: readSetting(stored, 'message') };
}

const config = createAppConfig<Levers>({
  path: PATH,
  read: readLevers,
  onUnavailable: reports.unavailable,
  onInvalid: reports.invalid,
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
  reports.invalid.mockReset();
});

describe('createAppConfig — what the listener says', () => {
  it('is loading, with no levers, until the first snapshot', () => {
    const { result } = renderConfig();
    expect(result.current.status).toBe('loading');
    expect(result.current.retrying).toBe(false);
    expect(result.current).not.toHaveProperty('levers');
  });

  it('a complete, valid document is ready and hands out exactly the stored values', async () => {
    const { result } = renderConfig();
    await emit(VALID);
    expect(result.current).toMatchObject({ status: 'ready', levers: VALID });
  });

  it('reads the snapshot outside a provider the same way', () => {
    expect(config.readAppConfigSnapshot(VALID)).toEqual({ status: 'ready', levers: VALID });
    expect(config.readAppConfigSnapshot(null)).toEqual({ status: 'invalid' });
  });
});

describe('createAppConfig — a document that was read and is not complete and valid', () => {
  it('a missing document is invalid, with no levers, and is reported', async () => {
    const { result } = renderConfig();
    await emit(null);
    expect(result.current.status).toBe('invalid');
    expect(result.current).not.toHaveProperty('levers');
    expect(reports.invalid).toHaveBeenCalledTimes(1);
    expect(reports.invalid).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'the document does not exist' }),
    );
    expect(reports.unavailable).not.toHaveBeenCalled();
  });

  it('a document missing a setting is invalid, with no levers, and is reported', async () => {
    const { result } = renderConfig();
    await emit({ appVersion: '3.1.0' });
    expect(result.current.status).toBe('invalid');
    expect(result.current).not.toHaveProperty('levers');
    expect(reports.invalid).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'message is missing or does not match' }),
    );
  });

  it('a setting with a bad value is invalid, with no levers, and is reported', async () => {
    const { result } = renderConfig();
    await emit({ ...VALID, appVersion: 42 });
    expect(result.current.status).toBe('invalid');
    expect(result.current).not.toHaveProperty('levers');
    expect(reports.invalid).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'appVersion is missing or does not match' }),
    );
  });

  it('a document fixed while the page listens becomes ready without a new subscription', async () => {
    const { result } = renderConfig();
    await emit(null);
    expect(result.current.status).toBe('invalid');
    const before = listenerStarts();
    await emit(VALID);
    expect(result.current).toMatchObject({ status: 'ready', levers: VALID });
    expect(listenerStarts()).toBe(before);
  });

  it('a ready document that turns invalid takes its levers away', async () => {
    const { result } = renderConfig();
    await emit(VALID);
    await emit({ ...VALID, message: false });
    expect(result.current.status).toBe('invalid');
    expect(result.current).not.toHaveProperty('levers');
  });

  it('a valid document reports nothing', async () => {
    renderConfig();
    await emit(VALID);
    expect(reports.invalid).not.toHaveBeenCalled();
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

  it('a failed read is unavailable after its quick retries, with no levers, reported once and never as invalid', async () => {
    store.failReads(() => true, firestoreError('permission-denied', 'Missing permissions.'));
    const { result } = renderConfig();
    await failLadder();
    expect(result.current).toMatchObject({ status: 'unavailable', retrying: false });
    expect(result.current).not.toHaveProperty('levers');
    expect(reports.unavailable).toHaveBeenCalledTimes(1);
    expect(reports.unavailable.mock.calls[0]![1]).toBe(APP_CONFIG_MAX_QUICK_ATTEMPTS);
    expect(reports.invalid).not.toHaveBeenCalled();
  });

  it('Try again restarts the listener and stays unavailable until it answers', async () => {
    store.failReads(() => true, unavailable());
    const { result } = renderConfig();
    await failLadder();

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

  it('an invalid document whose listener then fails stays invalid, never unavailable', async () => {
    const { result } = renderConfig();
    await emit(null);
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
    expect(result.current.status).toBe('invalid');
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
    expect(result.current).toMatchObject({
      status: 'ready',
      levers: { ...VALID, appVersion: '9.9.9' },
    });

    await act(async () => {
      store.failListeners(() => true, unavailable());
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
