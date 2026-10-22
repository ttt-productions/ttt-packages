// @vitest-environment jsdom
import React, { Suspense, startTransition, use, useLayoutEffect, useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import {
  MutationSessionEndedError,
  MutationSessionProvider,
  useSessionMutation,
  type SessionMutationFunctionContext,
} from '../../src/react/session-mutation.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeClient(mutationCache?: MutationCache) {
  return new QueryClient({ mutationCache, defaultOptions: { mutations: { retry: false } } });
}

function sessionWrapper(client: QueryClient, session: { uid: string | null }) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MutationSessionProvider currentUid={session.uid}>{children}</MutationSessionProvider>
      </QueryClientProvider>
    );
  };
}

function plainWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('useSessionMutation — the session that started the action', () => {
  it('hands the mutationFn the uid that started it, current while that session lasts', async () => {
    const seen: Array<{ uid: string | null; current: boolean }> = [];
    const session = { uid: 'member-a' as string | null };
    const { result } = renderHook(
      () =>
        useSessionMutation({
          mutationFn: async (_: void, context: SessionMutationFunctionContext) => {
            seen.push({ uid: context.session.uid, current: context.session.isCurrent() });
            return 'done';
          },
        }),
      { wrapper: sessionWrapper(makeClient(), session) },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).resolves.toBe('done');
    });

    expect(seen).toEqual([{ uid: 'member-a', current: true }]);
  });

  it('without a provider runs every action and every callback as current', async () => {
    const onSuccess = vi.fn();
    const perCall = vi.fn();
    const { result } = renderHook(
      () =>
        useSessionMutation({
          mutationFn: async (_: void, context: SessionMutationFunctionContext) => {
            context.session.assertCurrent();
            return context.session.isCurrent();
          },
          onSuccess,
        }),
      { wrapper: plainWrapper(makeClient()) },
    );

    act(() => {
      result.current.mutate(undefined, { onSuccess: perCall });
    });

    await waitFor(() => expect(perCall).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe(true);
  });
});

describe('useSessionMutation — an answer that lands after the session ended', () => {
  it('skips every success callback, hook-level and per call, and rejects mutateAsync as ended', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    const perCallSuccess = vi.fn();
    const perCallSettled = vi.fn();
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(
      () => useSessionMutation({ mutationFn, onSuccess, onSettled }),
      { wrapper: sessionWrapper(makeClient(), session) },
    );

    let request!: Promise<string>;
    act(() => {
      request = result.current.mutateAsync(undefined, {
        onSuccess: perCallSuccess,
        onSettled: perCallSettled,
      });
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();

    let rejection: unknown;
    await act(async () => {
      answer.resolve('done');
      rejection = await request.catch((error: unknown) => error);
    });

    expect(rejection).toBeInstanceOf(MutationSessionEndedError);
    expect((rejection as Error).name).toBe('AbortError');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
    expect(perCallSuccess).not.toHaveBeenCalled();
    expect(perCallSettled).not.toHaveBeenCalled();
  });

  it('skips every failure callback and keeps the failure as the ended error’s cause', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const onError = vi.fn();
    const perCallError = vi.fn();
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(() => useSessionMutation({ mutationFn, onError }), {
      wrapper: sessionWrapper(makeClient(), session),
    });

    let request!: Promise<string>;
    act(() => {
      request = result.current.mutateAsync(undefined, { onError: perCallError });
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = 'member-b';
    rerender();

    const failure = new Error('refused');
    let rejection: unknown;
    await act(async () => {
      answer.reject(failure);
      rejection = await request.catch((error: unknown) => error);
    });

    expect(rejection).toBeInstanceOf(MutationSessionEndedError);
    expect((rejection as Error).cause).toBe(failure);
    expect(onError).not.toHaveBeenCalled();
    expect(perCallError).not.toHaveBeenCalled();
  });

  it('ends the session on a sign-out even when the same member signs back in', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const onSuccess = vi.fn();
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(() => useSessionMutation({ mutationFn, onSuccess }), {
      wrapper: sessionWrapper(makeClient(), session),
    });

    let request!: Promise<string>;
    act(() => {
      request = result.current.mutateAsync(undefined);
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();
    session.uid = 'member-a';
    rerender();

    await act(async () => {
      answer.resolve('done');
      await expect(request).rejects.toBeInstanceOf(MutationSessionEndedError);
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('never retries an ended action, even under a retry policy', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(
      () => useSessionMutation({ mutationFn, retry: 3, retryDelay: 0 }),
      { wrapper: sessionWrapper(makeClient(), session) },
    );

    let request!: Promise<string>;
    act(() => {
      request = result.current.mutateAsync();
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();

    await act(async () => {
      answer.reject(new Error('unavailable'));
      await expect(request).rejects.toBeInstanceOf(MutationSessionEndedError);
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.failureCount).toBe(1);
  });

  it('never throws the ended error to an error boundary under throwOnError', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(
      () => useSessionMutation({ mutationFn, throwOnError: true }),
      { wrapper: sessionWrapper(makeClient(), session) },
    );

    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();
    await act(async () => {
      answer.reject(new Error('refused'));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(MutationSessionEndedError);
  });

  it('still hands the mutation cache the ended action, with its failure as the cause', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const cacheOnError = vi.fn();
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(() => useSessionMutation({ mutationFn }), {
      wrapper: sessionWrapper(makeClient(new MutationCache({ onError: cacheOnError })), session),
    });

    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();
    const failure = new Error('internal');
    await act(async () => {
      answer.reject(failure);
    });

    await waitFor(() => expect(cacheOnError).toHaveBeenCalledTimes(1));
    expect((cacheOnError.mock.calls[0]?.[0] as Error).cause).toBe(failure);
  });
});

describe('useSessionMutation — a late success', () => {
  it('rejects as ended with no cause, and hands the mutation cache that same ended error', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const cacheOnError = vi.fn();
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(() => useSessionMutation({ mutationFn }), {
      wrapper: sessionWrapper(makeClient(new MutationCache({ onError: cacheOnError })), session),
    });

    let request!: Promise<string>;
    act(() => {
      request = result.current.mutateAsync(undefined);
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();
    let rejection: unknown;
    await act(async () => {
      answer.resolve('committed');
      rejection = await request.catch((error: unknown) => error);
    });

    expect(rejection).toBeInstanceOf(MutationSessionEndedError);
    expect((rejection as Error).cause).toBeUndefined();
    await waitFor(() => expect(cacheOnError).toHaveBeenCalledTimes(1));
    expect(cacheOnError.mock.calls[0]?.[0]).toBe(rejection);
  });
});

describe('useSessionMutation — when a uid change ends the session', () => {
  it('ends the earlier session once the new uid commits, before a later answer is handled', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const onSuccess = vi.fn();
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(() => useSessionMutation({ mutationFn, onSuccess }), {
      wrapper: sessionWrapper(makeClient(), session),
    });

    act(() => {
      result.current.mutate(undefined);
    });
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    session.uid = 'member-b';
    rerender();
    await act(async () => {
      answer.resolve('done');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onSuccess).not.toHaveBeenCalled();

    const next = vi.fn(async () => 'next');
    mutationFn.mockImplementation(next);
    await act(async () => {
      await expect(result.current.mutateAsync(undefined)).resolves.toBe('next');
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when a render with another uid is discarded before it commits', async () => {
    const answer = deferred<string>();
    const mutationFn = vi.fn(() => answer.promise);
    const onSuccess = vi.fn();
    const client = makeClient();
    const never = new Promise<never>(() => {});
    const holder: { mutate?: () => void; setUid?: (uid: string | null) => void } = {};

    function Actor() {
      const mutation = useSessionMutation({ mutationFn, onSuccess });
      holder.mutate = () => mutation.mutate(undefined);
      return null;
    }
    function Suspender({ uid }: { uid: string | null }) {
      if (uid === 'member-b') use(never);
      return null;
    }
    function App() {
      const [uid, setUid] = useState<string | null>('member-a');
      holder.setUid = setUid;
      return (
        <QueryClientProvider client={client}>
          <MutationSessionProvider currentUid={uid}>
            <Actor />
            <Suspense fallback={null}>
              <Suspender uid={uid} />
            </Suspense>
          </MutationSessionProvider>
        </QueryClientProvider>
      );
    }
    render(<App />);

    act(() => holder.mutate!());
    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    await act(async () => {
      startTransition(() => holder.setUid!('member-b'));
    });
    await act(async () => {
      answer.resolve('done');
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("runs a mutation a child starts in its layout effect for the new uid as that uid's", async () => {
    const mutationFn = vi.fn(async () => 'done');
    const onSuccess = vi.fn();
    const client = makeClient();

    function Child({ uid }: { uid: string | null }) {
      const { mutate } = useSessionMutation({ mutationFn, onSuccess });
      useLayoutEffect(() => {
        if (uid === 'member-b') mutate(undefined);
      }, [uid, mutate]);
      return null;
    }
    function Tree({ uid }: { uid: string | null }) {
      return (
        <QueryClientProvider client={client}>
          <MutationSessionProvider currentUid={uid}>
            <Child uid={uid} />
          </MutationSessionProvider>
        </QueryClientProvider>
      );
    }
    const view = render(<Tree uid="member-a" />);
    view.rerender(<Tree uid="member-b" />);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});

describe('useSessionMutation — work that has not started when the session ends', () => {
  it('never starts a queued mutationFn whose session ended while it waited', async () => {
    const first = deferred<string>();
    const firstFn = vi.fn(() => first.promise);
    const secondFn = vi.fn(async () => 'second');
    const session = { uid: 'member-a' as string | null };
    const client = makeClient();
    const { result, rerender } = renderHook(
      () => ({
        first: useSessionMutation({ mutationFn: firstFn, scope: { id: 'queue' } }),
        second: useSessionMutation({ mutationFn: secondFn, scope: { id: 'queue' } }),
      }),
      { wrapper: sessionWrapper(client, session) },
    );

    let queued!: Promise<string>;
    act(() => {
      result.current.first.mutate();
      queued = result.current.second.mutateAsync();
    });
    await waitFor(() => expect(firstFn).toHaveBeenCalledTimes(1));
    session.uid = null;
    rerender();

    await act(async () => {
      first.resolve('first');
      await expect(queued).rejects.toBeInstanceOf(MutationSessionEndedError);
    });
    expect(secondFn).not.toHaveBeenCalled();
  });

  it('never starts a paused mutationFn whose session ended while it was offline', async () => {
    onlineManager.setOnline(false);
    const mutationFn = vi.fn(async () => 'done');
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(() => useSessionMutation({ mutationFn }), {
      wrapper: sessionWrapper(makeClient(), session),
    });

    let request!: Promise<string>;
    act(() => {
      request = result.current.mutateAsync();
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    session.uid = null;
    rerender();

    await act(async () => {
      onlineManager.setOnline(true);
      await expect(request).rejects.toBeInstanceOf(MutationSessionEndedError);
    });
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('never runs the mutationFn of a restored paused mutation that has no captured session', async () => {
    onlineManager.setOnline(false);
    const mutationFn = vi.fn(async () => 'done');
    const client = makeClient();
    const session = { uid: 'member-a' as string | null };
    const { result } = renderHook(() => useSessionMutation({ mutationKey: ['save'], mutationFn }), {
      wrapper: sessionWrapper(client, session),
    });

    act(() => {
      result.current.mutate(undefined);
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    const cache = client.getMutationCache();
    const [paused] = cache.getAll();
    cache.remove(paused!);
    const restored = cache.build(client, paused!.options, { ...paused!.state });

    await act(async () => {
      onlineManager.setOnline(true);
      await client.resumePausedMutations().catch(() => undefined);
    });

    await waitFor(() => expect(restored.state.status).toBe('error'));
    expect(restored.state.error).toBeInstanceOf(MutationSessionEndedError);
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('lets a multi-step mutationFn stop between its own awaits', async () => {
    const firstStep = deferred<void>();
    const secondStep = vi.fn(async () => undefined);
    const session = { uid: 'member-a' as string | null };
    const { result, rerender } = renderHook(
      () =>
        useSessionMutation({
          mutationFn: async (_: void, context: SessionMutationFunctionContext) => {
            await firstStep.promise;
            context.session.assertCurrent();
            await secondStep();
            return 'done';
          },
        }),
      { wrapper: sessionWrapper(makeClient(), session) },
    );

    let request!: Promise<string>;
    act(() => {
      request = result.current.mutateAsync();
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    session.uid = null;
    rerender();

    await act(async () => {
      firstStep.resolve();
      await expect(request).rejects.toBeInstanceOf(MutationSessionEndedError);
    });
    expect(secondStep).not.toHaveBeenCalled();
  });
});
