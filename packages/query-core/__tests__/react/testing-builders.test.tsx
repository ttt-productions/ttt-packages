import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import {
  InfiniteQueryObserver,
  MutationObserver,
  QueryClient,
  QueryClientProvider,
  QueryObserver,
  useQuery,
  type InfiniteData,
  type QueryKey,
  type QueryObserverResult,
} from '@tanstack/react-query';
import { useReadRetryState } from '../../src/react/use-read-retry-state.js';
import { MutationSessionProvider, useSessionMutation } from '../../src/react/session-mutation.js';
import {
  answeredRead,
  answeredThenFailedInfiniteRead,
  answeredThenFailedRead,
  failedInfiniteRead,
  failedRead,
  fetchingInfiniteRead,
  fetchingNextPageRead,
  fetchingRead,
  idleInfiniteRead,
  idleRead,
  infiniteRead,
  loadingInfiniteRead,
  loadingRead,
  nextPageFailedRead,
  retryingAnsweredInfiniteRead,
  retryingAnsweredRead,
  retryingInfiniteRead,
  retryingNextPageRead,
  retryingRead,
} from '../../src/react/testing/read-builders.js';
import {
  failedMutation,
  failedSessionMutation,
  idleMutation,
  idleSessionMutation,
  pendingMutation,
  pendingSessionMutation,
  sessionMutationContext,
} from '../../src/react/testing/mutation-builders.js';

const FLAGS = [
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
] as const;

const flagsOf = (result: QueryObserverResult<unknown, Error>) =>
  Object.fromEntries(FLAGS.map((flag) => [flag, result[flag]]));

interface Driven {
  observer: QueryObserver<string, Error>;
  answer(value: string): void;
  fail(error: Error): void;
}

function drivenQuery(): Driven {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let settle: { resolve(value: string): void; reject(error: Error): void } | null = null;
  const observer = new QueryObserver<string, Error>(client, {
    queryKey: ['driven'],
    queryFn: () =>
      new Promise<string>((resolve, reject) => {
        settle = { resolve, reject };
      }),
  });
  observer.subscribe(() => {});
  const take = () => {
    const current = settle;
    settle = null;
    if (!current) throw new Error('no fetch is in flight');
    return current;
  };
  return {
    observer,
    answer: (value) => take().resolve(value),
    fail: (error) => take().reject(error),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const boom = new Error('boom');

describe('every read builder matches a real query in that state', () => {
  it('first load in flight', () => {
    const real = drivenQuery();
    expect(flagsOf(loadingRead())).toEqual(flagsOf(real.observer.getCurrentResult()));
  });

  it('answered', async () => {
    const real = drivenQuery();
    real.answer('x');
    await flush();
    expect(flagsOf(answeredRead('x'))).toEqual(flagsOf(real.observer.getCurrentResult()));
  });

  it('a background fetch over an answer', async () => {
    const real = drivenQuery();
    real.answer('x');
    await flush();
    void real.observer.refetch();
    expect(flagsOf(fetchingRead('x'))).toEqual(flagsOf(real.observer.getCurrentResult()));
  });

  it('failed with nothing answered', async () => {
    const real = drivenQuery();
    real.fail(boom);
    await flush();
    expect(flagsOf(failedRead(boom))).toEqual(flagsOf(real.observer.getCurrentResult()));
  });

  it('retrying a read that never answered — pending, its error cleared', async () => {
    const real = drivenQuery();
    real.fail(boom);
    await flush();
    void real.observer.refetch();
    expect(flagsOf(retryingRead(boom))).toEqual(flagsOf(real.observer.getCurrentResult()));
  });

  it('answered, then failed — the error beside the kept answer', async () => {
    const real = drivenQuery();
    real.answer('x');
    await flush();
    void real.observer.refetch();
    real.fail(boom);
    await flush();
    expect(flagsOf(answeredThenFailedRead('x', boom))).toEqual(
      flagsOf(real.observer.getCurrentResult()),
    );
  });

  it('retrying that failure', async () => {
    const real = drivenQuery();
    real.answer('x');
    await flush();
    void real.observer.refetch();
    real.fail(boom);
    await flush();
    void real.observer.refetch();
    expect(flagsOf(retryingAnsweredRead('x', boom))).toEqual(
      flagsOf(real.observer.getCurrentResult()),
    );
  });

  it('a disabled read that never fetched', () => {
    const client = new QueryClient();
    const real = new QueryObserver<string, Error>(client, { queryKey: ['off'], enabled: false });
    expect(flagsOf(idleRead())).toEqual(flagsOf(real.getCurrentResult()));
  });
});

describe('every read builder carries the retry state the real hook derives', () => {
  it('holds a never-answered failure through its retry, as useReadRetryState does', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => {
        const query = useQuery<string, Error>({
          queryKey: ['hook'],
          queryFn: () => {
            calls += 1;
            return calls === 1 ? Promise.reject(boom) : new Promise<string>(() => {});
          },
        });
        return { query, retryState: useReadRetryState(query, ['hook']) };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.retryState).toEqual(failedRead(boom).retryState);
    void result.current.query.refetch();
    await waitFor(() => expect(result.current.query.isFetching).toBe(true));
    expect(result.current.retryState).toEqual(retryingRead(boom).retryState);
  });

  it('states each built retry state', () => {
    const settled = { error: null, isRetrying: false, isLoading: false };
    expect(answeredRead('x').retryState).toEqual(settled);
    expect(fetchingRead('x').retryState).toEqual(settled);
    expect(loadingRead().retryState).toEqual({ ...settled, isLoading: true });
    expect(failedRead(boom).retryState).toEqual({ ...settled, error: boom });
    expect(retryingRead(boom).retryState).toEqual({ ...settled, error: boom, isRetrying: true });
    expect(answeredThenFailedRead('x', boom).retryState).toEqual({ ...settled, error: boom });
    expect(retryingAnsweredRead('x', boom).retryState).toEqual({
      ...settled,
      error: boom,
      isRetrying: true,
    });
  });
});

type Page = { next: number | null };

const INFINITE_FLAGS = [
  ...FLAGS,
  'hasNextPage',
  'isFetchingNextPage',
  'isFetchNextPageError',
  'isFetchingPreviousPage',
  'isFetchPreviousPageError',
] as const;

const infiniteFlagsOf = (result: Record<(typeof INFINITE_FLAGS)[number], unknown>) =>
  Object.fromEntries(INFINITE_FLAGS.map((flag) => [flag, result[flag]]));

interface DrivenInfinite {
  observer: InfiniteQueryObserver<Page, Error, InfiniteData<Page, number>, QueryKey, number>;
  answer(page: Page): void;
  fail(error: Error): void;
}

function drivenInfiniteQuery(): DrivenInfinite {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let settle: { resolve(page: Page): void; reject(error: Error): void } | null = null;
  const observer = new InfiniteQueryObserver<
    Page,
    Error,
    InfiniteData<Page, number>,
    QueryKey,
    number
  >(client, {
    queryKey: ['driven-infinite'],
    initialPageParam: 0,
    getNextPageParam: (last) => last.next,
    queryFn: () =>
      new Promise<Page>((resolve, reject) => {
        settle = { resolve, reject };
      }),
  });
  observer.subscribe(() => {});
  const take = () => {
    const current = settle;
    settle = null;
    if (!current) throw new Error('no fetch is in flight');
    return current;
  };
  return {
    observer,
    answer: (page) => take().resolve(page),
    fail: (error) => take().reject(error),
  };
}

const spec = { initialPageParam: 0, getNextPageParam: (last: Page) => last.next };
const first: Page = { next: 1 };
const loaded = { ...spec, pages: [first] };

async function answeredInfinite(): Promise<DrivenInfinite> {
  const real = drivenInfiniteQuery();
  real.answer(first);
  await flush();
  return real;
}

async function refreshFailed(): Promise<DrivenInfinite> {
  const real = await answeredInfinite();
  void real.observer.refetch();
  real.fail(boom);
  await flush();
  return real;
}

async function nextPageFailed(): Promise<DrivenInfinite> {
  const real = await answeredInfinite();
  void real.observer.fetchNextPage();
  real.fail(boom);
  await flush();
  return real;
}

describe('every infinite read builder matches a real infinite query in that state', () => {
  it('a disabled infinite read that never fetched', () => {
    const client = new QueryClient();
    const real = new InfiniteQueryObserver<
      Page,
      Error,
      InfiniteData<Page, number>,
      QueryKey,
      number
    >(client, { queryKey: ['off-infinite'], enabled: false, ...spec });
    expect(infiniteFlagsOf(idleInfiniteRead(spec))).toEqual(
      infiniteFlagsOf(real.getCurrentResult()),
    );
  });

  it('the first page in flight', () => {
    const real = drivenInfiniteQuery();
    expect(infiniteFlagsOf(loadingInfiniteRead(spec))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('answered, with another page to load', async () => {
    const real = await answeredInfinite();
    expect(infiniteFlagsOf(infiniteRead(loaded))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('the first page failed', async () => {
    const real = drivenInfiniteQuery();
    real.fail(boom);
    await flush();
    expect(infiniteFlagsOf(failedInfiniteRead(spec, boom))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('retrying a first page that failed — pending, its error cleared', async () => {
    const real = drivenInfiniteQuery();
    real.fail(boom);
    await flush();
    void real.observer.refetch();
    expect(infiniteFlagsOf(retryingInfiniteRead(spec, boom))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('a refresh over the kept pages', async () => {
    const real = await answeredInfinite();
    void real.observer.refetch();
    expect(infiniteFlagsOf(fetchingInfiniteRead(loaded))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('a refresh that failed over the kept pages', async () => {
    const real = await refreshFailed();
    expect(infiniteFlagsOf(answeredThenFailedInfiniteRead(loaded, boom))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('retrying that refresh', async () => {
    const real = await refreshFailed();
    void real.observer.refetch();
    expect(infiniteFlagsOf(retryingAnsweredInfiniteRead(loaded, boom))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('the next page in flight', async () => {
    const real = await answeredInfinite();
    void real.observer.fetchNextPage();
    expect(infiniteFlagsOf(fetchingNextPageRead(loaded))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('the next page failed, the loaded pages kept', async () => {
    const real = await nextPageFailed();
    expect(infiniteFlagsOf(nextPageFailedRead(loaded, boom))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('retrying the failed next page', async () => {
    const real = await nextPageFailed();
    void real.observer.fetchNextPage();
    expect(infiniteFlagsOf(retryingNextPageRead(loaded, boom))).toEqual(
      infiniteFlagsOf(real.observer.getCurrentResult()),
    );
  });

  it('states each built retry state', () => {
    const settled = { error: null, isRetrying: false, isLoading: false };
    const retrying = { ...settled, error: boom, isRetrying: true };
    expect(loadingInfiniteRead(spec).retryState).toEqual({ ...settled, isLoading: true });
    expect(fetchingInfiniteRead(loaded).retryState).toEqual(settled);
    expect(failedInfiniteRead(spec, boom).retryState).toEqual({ ...settled, error: boom });
    expect(retryingInfiniteRead(spec, boom).retryState).toEqual(retrying);
    expect(answeredThenFailedInfiniteRead(loaded, boom).retryState).toEqual({
      ...settled,
      error: boom,
    });
    expect(retryingAnsweredInfiniteRead(loaded, boom).retryState).toEqual(retrying);
    expect(retryingNextPageRead(loaded, boom).retryState).toEqual(retrying);
  });

  it('derives page params from the case’s getNextPageParam and applies its select', () => {
    expect(infiniteRead({ ...spec, pages: [first, { next: null }] }).data?.pageParams).toEqual([
      0, 1,
    ]);
    const read = infiniteRead({
      ...spec,
      pages: [{ next: null, rows: ['a', 'b'] }],
      select: (data) => data.pages.flatMap((page) => page.rows),
    });
    expect(read.data).toEqual(['a', 'b']);
  });
});

const MUTATION_FLAGS = [
  'status',
  'isIdle',
  'isPending',
  'isSuccess',
  'isError',
  'isPaused',
  'variables',
  'data',
  'error',
  'failureCount',
] as const;

const mutationFlagsOf = (result: Record<(typeof MUTATION_FLAGS)[number], unknown>) =>
  Object.fromEntries(MUTATION_FLAGS.map((flag) => [flag, result[flag]]));

describe('every mutation builder matches a real mutation in that state', () => {
  it('idle', () => {
    const real = new MutationObserver<string, Error, { id: string }>(new QueryClient(), {});
    expect(mutationFlagsOf(idleMutation<string, { id: string }>())).toEqual(
      mutationFlagsOf(real.getCurrentResult()),
    );
  });

  it('pending with the variables it runs with', () => {
    const real = new MutationObserver<string, Error, { id: string }>(new QueryClient(), {
      mutationFn: () => new Promise<string>(() => {}),
    });
    void real.mutate({ id: 'a' });
    expect(mutationFlagsOf(pendingMutation<string, { id: string }>({ id: 'a' }))).toEqual(
      mutationFlagsOf(real.getCurrentResult()),
    );
  });

  it('a session mutation, idle and then pending, as useSessionMutation reports it', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <MutationSessionProvider currentUid="u1">{children}</MutationSessionProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useSessionMutation<string, Error, { id: string }>({
          mutationFn: () => new Promise<string>(() => {}),
        }),
      { wrapper },
    );
    expect(mutationFlagsOf(idleSessionMutation<string, { id: string }>())).toEqual(
      mutationFlagsOf(result.current),
    );
    act(() => result.current.mutate({ id: 'a' }));
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(mutationFlagsOf(pendingSessionMutation<string, { id: string }>({ id: 'a' }))).toEqual(
      mutationFlagsOf(result.current),
    );
  });

  it('failed with the variables it ran with', async () => {
    const real = new MutationObserver<string, Error, { id: string }>(new QueryClient(), {
      mutationFn: () => Promise.reject(boom),
    });
    // The rejection is the failed state the case compares against.
    await real.mutate({ id: 'a' }).catch(() => undefined);
    expect(
      mutationFlagsOf(await failedMutation<string, { id: string }>(boom, { id: 'a' })),
    ).toEqual(mutationFlagsOf(real.getCurrentResult()));
  });

  it('a session mutation that failed, as useSessionMutation reports it', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <MutationSessionProvider currentUid="u1">{children}</MutationSessionProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useSessionMutation<string, Error, { id: string }>({
          mutationFn: () => Promise.reject(boom),
        }),
      { wrapper },
    );
    act(() => result.current.mutate({ id: 'a' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(
      mutationFlagsOf(await failedSessionMutation<string, { id: string }>(boom, { id: 'a' })),
    ).toEqual(mutationFlagsOf(result.current));
  });

  it('carries the onMutate result type and the error type of the hook it stands in for', async () => {
    const onMutateTyped: ReturnType<
      typeof useSessionMutation<string, unknown, { id: string }, { previous: number }>
    > = idleSessionMutation<string, { id: string }, { previous: number }, unknown>();
    expect(onMutateTyped.isIdle).toBe(true);
    const failed = await failedMutation<string, { id: string }, { previous: number }, unknown>(
      'refused',
      { id: 'a' },
    );
    expect(failed.error).toBe('refused');
  });

  it('hands a mutate callback the context of a current session', () => {
    const context = sessionMutationContext('u1');
    expect(context.session.uid).toBe('u1');
    expect(context.session.isCurrent()).toBe(true);
    expect(() => context.session.assertCurrent()).not.toThrow();
  });

  it('runs only the handlers the case gives it', async () => {
    await expect(idleMutation<string, { id: string }>().mutateAsync({ id: 'a' })).rejects.toThrow(
      /not run in the test/,
    );
    const mutateAsync = async () => 'done';
    await expect(idleSessionMutation<string, void>({ mutateAsync }).mutateAsync()).resolves.toBe(
      'done',
    );
  });
});
