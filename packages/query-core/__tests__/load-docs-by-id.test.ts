import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const { store } = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return { store: makeInMemoryClientFirestore() };
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { loadFirestoreDocsById } from '../src/react/firestore/load-docs-by-id.js';
import { MAX_CONCURRENT_DOC_GETS } from '../src/react/firestore/batch-doc-loader.js';
import {
  batchReadIn,
  docGetIn,
  docGetOf,
  holdReads,
  idsOf,
  readsMatching,
} from './helpers/batch-docs-reads.js';

const COLLECTION = 'socialPosts';
const seed = (id: string, data: Record<string, unknown>) => store.seed(`${COLLECTION}/${id}`, data);
const getCalls = () => readsMatching(store, docGetIn(COLLECTION)).flatMap(idsOf);

function load(ids: readonly string[], queryClient = new QueryClient()) {
  return loadFirestoreDocsById({ queryClient, db: store.db, collectionPath: COLLECTION, ids });
}

beforeEach(() => {
  store.reset();
});

describe('loadFirestoreDocsById', () => {
  it('reads each id on its own and answers every outcome in input order', async () => {
    seed('a', { v: 1 });
    seed('c', { v: 3 });

    expect(await load(['c', 'missing', 'a'])).toEqual([
      { id: 'c', status: 'present', doc: { id: 'c', v: 3 } },
      { id: 'missing', status: 'absent' },
      { id: 'a', status: 'present', doc: { id: 'a', v: 1 } },
    ]);
    expect(getCalls().sort()).toEqual(['a', 'c', 'missing']);
    expect(readsMatching(store, batchReadIn(COLLECTION))).toEqual([]);
  });

  it('answers a denied id as absent while the readable ids still load', async () => {
    seed('visible', { v: 1 });
    seed('hidden', { v: 2 });
    store.failReads(
      docGetOf(COLLECTION, 'hidden'),
      firestoreError('permission-denied', 'permission-denied'),
    );

    expect(await load(['hidden', 'visible'])).toEqual([
      { id: 'hidden', status: 'absent' },
      { id: 'visible', status: 'present', doc: { id: 'visible', v: 1 } },
    ]);
  });

  it('rejects on a read failure that is not a denial', async () => {
    seed('a', { v: 1 });
    store.failReads(docGetOf(COLLECTION, 'a'), firestoreError('unavailable', 'unavailable'));

    await expect(load(['a'])).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('never opens more parallel document gets than the shared limit', async () => {
    const hold = holdReads(store, docGetIn(COLLECTION));
    const ids = Array.from({ length: MAX_CONCURRENT_DOC_GETS + 2 }, (_, i) => `p${i}`);
    for (const id of ids) seed(id, { v: id });

    const pending = load(ids);
    await vi.waitFor(() => expect(getCalls()).toHaveLength(MAX_CONCURRENT_DOC_GETS));
    await Promise.resolve();
    expect(getCalls()).toHaveLength(MAX_CONCURRENT_DOC_GETS);

    hold.holding = false;
    for (const held of [...hold.waiting]) held.release();
    const outcomes = await pending;
    expect(outcomes.map((outcome) => outcome.status)).toEqual(ids.map(() => 'present'));
  });
});
