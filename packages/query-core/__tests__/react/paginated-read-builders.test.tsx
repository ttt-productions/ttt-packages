// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { firestoreError } from '@ttt-productions/firebase-helpers/firestore-client/testing';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { firestoreTestWrapper } from '../../src/react/testing/firestore-test-wrapper.js';
import { useFirestorePaginated } from '../../src/react/firestore/use-firestore-paginated.js';
import {
  answeredPaginatedRead,
  answeredThenFailedPaginatedRead,
  failedPaginatedRead,
  fetchingPaginatedRead,
  loadingPaginatedRead,
  retryingAnsweredPaginatedRead,
  retryingPaginatedRead,
  type BuiltPaginatedRead,
} from '../../src/react/testing/paginated-read-builders.js';
import { failUntilStopped, holdNext } from '../helpers/listener-controls.js';

type Item = { n: number };

const FIELDS = [
  'status',
  'fetchStatus',
  'isError',
  'isPending',
  'isLoading',
  'isFetching',
  'isRefetching',
  'isRefetchError',
  'isLoadingError',
  'isSuccess',
  'data',
  'error',
  'page',
  'pageSize',
  'hasNextPage',
  'hasPrevPage',
] as const;

const fieldsOf = (result: Omit<BuiltPaginatedRead<Item>, 'retryState'>) =>
  Object.fromEntries(FIELDS.map((field) => [field, result[field]]));

const denied = firestoreError('permission-denied', 'denied');
const isItemsRead = () => true;
const FIRST_PAGE = [
  { id: 'a', n: 1 },
  { id: 'b', n: 2 },
];

function renderPaginated() {
  const { Wrapper: wrapper } = firestoreTestWrapper(store.db);
  return renderHook(
    () =>
      useFirestorePaginated<Item>({
        collectionPath: 'items',
        queryKey: ['items'],
        pageSize: 2,
      }),
    { wrapper },
  );
}

beforeEach(() => {
  store.reset();
  store.seed('items/a', { n: 1 });
  store.seed('items/b', { n: 2 });
  store.seed('items/c', { n: 3 });
});

describe('every paginated read builder matches the real paginated read in that state', () => {
  it('the first page answered, with a next page', async () => {
    const { result } = renderPaginated();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const built = answeredPaginatedRead<Item>(
      [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ],
      { pageSize: 2, hasNextPage: true },
    );
    expect(fieldsOf(built)).toEqual(fieldsOf(result.current));
  });

  it('a later page answered, the last one', async () => {
    const { result } = renderPaginated();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'c', n: 3 }]));
    const built = answeredPaginatedRead<Item>([{ id: 'c', n: 3 }], { page: 2, pageSize: 2 });
    expect(fieldsOf(built)).toEqual(fieldsOf(result.current));
  });

  it('the first load in flight', async () => {
    const release = holdNext(store, isItemsRead);
    const { result } = renderPaginated();
    await waitFor(() => expect(store.queries()).toHaveLength(1));
    expect(fieldsOf(loadingPaginatedRead<Item>({ pageSize: 2 }))).toEqual(fieldsOf(result.current));
    release();
  });

  it('the first load failed', async () => {
    store.failReads(isItemsRead, denied);
    const { result } = renderPaginated();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fieldsOf(failedPaginatedRead<Item>(denied, { pageSize: 2 }))).toEqual(
      fieldsOf(result.current),
    );
  });

  it('retrying a first load that failed', async () => {
    const lift = failUntilStopped(store, isItemsRead, denied);
    const { result } = renderPaginated();
    await waitFor(() => expect(result.current.isError).toBe(true));
    lift();
    const release = holdNext(store, isItemsRead);
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(fieldsOf(retryingPaginatedRead<Item>(denied, { pageSize: 2 }))).toEqual(
      fieldsOf(result.current),
    );
    release();
  });

  it('answered, then failed — the error beside the kept page', async () => {
    const { result } = renderPaginated();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    store.failReads(isItemsRead, denied);
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const built = answeredThenFailedPaginatedRead<Item>(
      [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ],
      denied,
      { pageSize: 2, hasNextPage: true },
    );
    expect(fieldsOf(built)).toEqual(fieldsOf(result.current));
  });

  it('a refresh of the page shown, its rows kept', async () => {
    const { result } = renderPaginated();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const release = holdNext(store, isItemsRead);
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    const built = fetchingPaginatedRead<Item>(FIRST_PAGE, { pageSize: 2, hasNextPage: true });
    expect(fieldsOf(built)).toEqual(fieldsOf(result.current));
    release();
  });

  it('retrying a refresh that failed, its rows kept', async () => {
    const { result } = renderPaginated();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const lift = failUntilStopped(store, isItemsRead, denied);
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    lift();
    const release = holdNext(store, isItemsRead);
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    const built = retryingAnsweredPaginatedRead<Item>(FIRST_PAGE, denied, {
      pageSize: 2,
      hasNextPage: true,
    });
    expect(fieldsOf(built)).toEqual(fieldsOf(result.current));
    release();
  });
});

describe('paginated read builders move pages through the case’s own setPage', () => {
  it('nextPage and prevPage ask for the neighbouring pages', () => {
    const setPage = vi.fn<(page: number) => void>();
    const read = answeredPaginatedRead<Item>([], { page: 3, setPage });
    read.nextPage();
    read.prevPage();
    read.setPage(7);
    expect(setPage.mock.calls).toEqual([[4], [2], [7]]);
  });
});
