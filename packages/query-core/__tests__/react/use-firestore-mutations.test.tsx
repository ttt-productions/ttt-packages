// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WriteBatch } from 'firebase/firestore';

const { writes, pendingWrite } = vi.hoisted(() => {
  const writes: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  const pendingWrite = () =>
    new Promise<void>((resolve, reject) => {
      writes.push({ resolve, reject });
    });
  return { writes, pendingWrite };
});

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../../test/client-firestore-fake.js');
  const batch: WriteBatch = {
    set: () => batch,
    update: () => batch,
    delete: () => batch,
    commit: pendingWrite,
  };
  return clientFirestoreFake(importOriginal, store, {
    setDoc: pendingWrite,
    updateDoc: pendingWrite,
    deleteDoc: pendingWrite,
    writeBatch: () => batch,
  });
});

import { FirestoreProvider } from '../../src/react/firestore/context.js';
import {
  useFirestoreBatch,
  useFirestoreDelete,
  useFirestoreSet,
  useFirestoreUpdate,
} from '../../src/react/firestore/use-firestore-mutations.js';
import {
  MutationSessionEndedError,
  MutationSessionProvider,
} from '../../src/react/session-mutation.js';

const LIST_KEY = ['items', 'list'];
const DETAIL_KEY = ['items', 'detail', 'i1'];

beforeEach(() => {
  writes.length = 0;
});

function setup<T>(useHook: () => T) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(DETAIL_KEY, { title: 'Before' });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const session = { uid: 'member-a' as string | null };
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MutationSessionProvider currentUid={session.uid}>
          <FirestoreProvider db={store.db}>{children}</FirestoreProvider>
        </MutationSessionProvider>
      </QueryClientProvider>
    );
  }
  const rendered = renderHook(useHook, { wrapper: Wrapper });
  const endSession = () => {
    session.uid = null;
    rendered.rerender();
  };
  return { client, invalidate, endSession, ...rendered };
}

describe('the Firestore mutation hooks after the session that started them ended', () => {
  it('a set refreshes nothing for the next session', async () => {
    const { result, invalidate, endSession } = setup(() =>
      useFirestoreSet<{ title: string }>({ invalidateKeys: [LIST_KEY] }),
    );

    let request!: Promise<unknown>;
    act(() => {
      request = result.current.mutateAsync({ docPath: 'items/i1', data: { title: 'After' } });
    });
    await waitFor(() => expect(writes).toHaveLength(1));
    endSession();
    await act(async () => {
      writes[0].resolve();
      await expect(request).rejects.toBeInstanceOf(MutationSessionEndedError);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('a set in the same session refreshes its keys', async () => {
    const { result, invalidate } = setup(() =>
      useFirestoreSet<{ title: string }>({ invalidateKeys: [LIST_KEY] }),
    );

    let request!: Promise<unknown>;
    act(() => {
      request = result.current.mutateAsync({ docPath: 'items/i1', data: { title: 'After' } });
    });
    await waitFor(() => expect(writes).toHaveLength(1));
    await act(async () => {
      writes[0].resolve();
      await request;
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: LIST_KEY });
  });

  it('a failed optimistic update neither rolls back nor refreshes the next session’s cache', async () => {
    const { result, client, invalidate, endSession } = setup(() =>
      useFirestoreUpdate<{ title: string }>({
        invalidateKeys: [LIST_KEY],
        optimistic: { queryKey: DETAIL_KEY, updater: (_old, data) => ({ title: data.title! }) },
      }),
    );

    let request!: Promise<unknown>;
    act(() => {
      request = result.current.mutateAsync({ docPath: 'items/i1', data: { title: 'After' } });
    });
    await waitFor(() => expect(writes).toHaveLength(1));
    endSession();
    client.setQueryData(DETAIL_KEY, { title: 'Next session' });
    await act(async () => {
      writes[0].reject(new Error('refused'));
      await expect(request).rejects.toBeInstanceOf(MutationSessionEndedError);
    });

    expect(client.getQueryData(DETAIL_KEY)).toEqual({ title: 'Next session' });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('a delete and a batch refresh nothing for the next session', async () => {
    const { result, invalidate, endSession } = setup(() => ({
      remove: useFirestoreDelete({ invalidateKeys: [LIST_KEY] }),
      batch: useFirestoreBatch({ invalidateKeys: [LIST_KEY] }),
    }));

    let removal!: Promise<unknown>;
    let batch!: Promise<unknown>;
    act(() => {
      removal = result.current.remove.mutateAsync({ docPath: 'items/i1' });
      batch = result.current.batch.mutateAsync({
        operations: [{ type: 'delete', docPath: 'items/i2' }],
      });
    });
    await waitFor(() => expect(writes).toHaveLength(2));
    endSession();
    await act(async () => {
      for (const write of writes) write.resolve();
      await expect(removal).rejects.toBeInstanceOf(MutationSessionEndedError);
      await expect(batch).rejects.toBeInstanceOf(MutationSessionEndedError);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
