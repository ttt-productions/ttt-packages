// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpsCallable, type Functions } from 'firebase/functions';
import {
  createCallables,
  MAX_RESUMABLE_CALLS,
  type CallablePolicy,
  type CallableErrorRouting,
} from '../src/react/create-callables.js';

const TIMEOUT_MS = 30_000;
const functionsInstance = {} as Functions;

function makePolicy(overrides: Partial<CallablePolicy> = {}) {
  return {
    getFunctions: () => functionsInstance,
    timeoutMs: TIMEOUT_MS,
    resolveLimitedUseAppCheck: vi.fn((requested: boolean) => requested),
    captureFault: vi.fn(),
    captureRecoveredFallback: vi.fn(),
    onActionError: vi.fn(),
    ...overrides,
  } satisfies CallablePolicy;
}

function mockCallable(...answers: Array<unknown | (() => never)>) {
  const invoke = vi.fn();
  for (const answer of answers) {
    invoke.mockImplementationOnce(async () => {
      if (typeof answer === 'function') (answer as () => never)();
      return { data: answer };
    });
  }
  vi.mocked(httpsCallable).mockReturnValue(
    Object.assign(invoke, { stream: vi.fn() }) as unknown as ReturnType<typeof httpsCallable>,
  );
  return invoke;
}

function fault(code = 'functions/internal'): Error {
  return Object.assign(new Error('boom'), { code });
}

function throwing(error: Error) {
  return () => {
    throw error;
  };
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function retryingClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } });
}

const DEFAULT_ROUTING: CallableErrorRouting = {
  showErrorToast: true,
  answeredRefusals: [],
  isAnswerSurfacedByCaller: undefined,
};

describe('createCallables — action', () => {
  beforeEach(() => vi.mocked(httpsCallable).mockReset());

  it('calls the declared function with the input and returns its answer', async () => {
    const invoke = mockCallable({ ok: true });
    const policy = makePolicy();
    const useAction = createCallables(policy).createCallableHook<{ id: string }, { ok: boolean }>(
      'doThing',
    );
    const { result } = renderHook(() => useAction(), { wrapper: wrapperFor(retryingClient()) });

    let answer: unknown;
    await act(async () => {
      answer = await result.current.mutateAsync({ id: 'a' });
    });

    expect(answer).toEqual({ ok: true });
    expect(vi.mocked(httpsCallable).mock.calls[0]?.[1]).toBe('doThing');
    expect(vi.mocked(httpsCallable).mock.calls[0]?.[2]).toEqual({ timeout: TIMEOUT_MS });
    expect(invoke).toHaveBeenCalledWith({ id: 'a' });
  });

  it('never retries a failed call, even under a client default that retries mutations', async () => {
    const invoke = mockCallable(throwing(fault()), { ok: true }, { ok: true });
    const useAction = createCallables(makePolicy()).createCallableHook<void, unknown>('doThing');
    const { result } = renderHook(() => useAction({ retry: 3 } as never), {
      wrapper: wrapperFor(retryingClient()),
    });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({
        code: 'functions/internal',
      });
    });

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('routes a failure once with the default routing and captures the fault exactly once', async () => {
    const error = fault();
    mockCallable(throwing(error));
    const policy = makePolicy();
    const useAction = createCallables(policy).createCallableHook<void, unknown>('doThing');
    const { result } = renderHook(() => useAction(), { wrapper: wrapperFor(retryingClient()) });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(policy.onActionError).toHaveBeenCalledTimes(1);
    expect(policy.onActionError).toHaveBeenCalledWith(error, DEFAULT_ROUTING);
    expect(policy.captureFault).toHaveBeenCalledTimes(1);
    expect(policy.captureFault).toHaveBeenCalledWith(error, {
      functionName: 'doThing',
      timeoutMs: TIMEOUT_MS,
    });
    expect(policy.captureRecoveredFallback).not.toHaveBeenCalled();
  });

  it('hands the routing every call-site option it was given', async () => {
    const error = fault('functions/not-found');
    mockCallable(throwing(error));
    const policy = makePolicy();
    const isAnswerSurfacedByCaller = (e: unknown) => e === error;
    const useAction = createCallables(policy).createCallableHook<void, unknown>('doThing');
    const { result } = renderHook(
      () =>
        useAction({
          showErrorToast: false,
          answeredRefusals: ['not-found'],
          isAnswerSurfacedByCaller,
        }),
      { wrapper: wrapperFor(retryingClient()) },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(policy.onActionError).toHaveBeenCalledWith(error, {
      showErrorToast: false,
      answeredRefusals: ['not-found'],
      isAnswerSurfacedByCaller,
    });
  });

  it('keeps its routing options out of the mutation and passes the TanStack options through', async () => {
    const error = fault();
    mockCallable(throwing(error));
    const onError = vi.fn();
    const useAction = createCallables(makePolicy()).createCallableHook<void, unknown>('doThing');
    const { result } = renderHook(() => useAction({ onError, showErrorToast: false }), {
      wrapper: wrapperFor(retryingClient()),
    });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBe(error);
  });

  it('with captureFaults false captures the failure nowhere, leaving it to the caller', async () => {
    const error = fault();
    mockCallable(throwing(error));
    const policy = makePolicy();
    const useAction = createCallables(policy).createCallableHook<void, unknown>('doThing');
    const { result } = renderHook(() => useAction({ captureFaults: false }), {
      wrapper: wrapperFor(retryingClient()),
    });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(policy.captureFault).not.toHaveBeenCalled();
    expect(policy.captureRecoveredFallback).not.toHaveBeenCalled();
    expect(policy.onActionError).toHaveBeenCalledTimes(1);
  });
});

describe('createCallables — limited-use App Check declaration', () => {
  beforeEach(() => vi.mocked(httpsCallable).mockReset());

  it('a callable declared limited-use reaches the transport with a limited-use token', async () => {
    mockCallable({});
    const policy = makePolicy();
    const useAction = createCallables(policy).createCallableHook<void, unknown>('sensitive', {
      limitedUseAppCheck: true,
    });
    const { result } = renderHook(() => useAction(), { wrapper: wrapperFor(retryingClient()) });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(policy.resolveLimitedUseAppCheck).toHaveBeenCalledWith(true);
    expect(vi.mocked(httpsCallable).mock.calls[0]?.[2]).toEqual({
      timeout: TIMEOUT_MS,
      limitedUseAppCheckTokens: true,
    });
  });

  it('a callable not declared limited-use asks for none', async () => {
    mockCallable({});
    const policy = makePolicy();
    const useRead = createCallables(policy).createCallableReader<void, unknown>('plain');
    const { result } = renderHook(() => useRead());

    await result.current();

    expect(policy.resolveLimitedUseAppCheck).toHaveBeenCalledWith(false);
    expect(vi.mocked(httpsCallable).mock.calls[0]?.[2]).toEqual({ timeout: TIMEOUT_MS });
  });

  it('the policy can suppress a declared limited-use token', async () => {
    mockCallable({});
    const policy = makePolicy({ resolveLimitedUseAppCheck: vi.fn(() => false) });
    const useInvoke = createCallables(policy).createCallableInvoker<void, unknown>('sensitive', {
      limitedUseAppCheck: true,
    });
    const { result } = renderHook(() => useInvoke());

    await result.current();

    expect(policy.resolveLimitedUseAppCheck).toHaveBeenCalledWith(true);
    expect(vi.mocked(httpsCallable).mock.calls[0]?.[2]).toEqual({ timeout: TIMEOUT_MS });
  });
});

describe('createCallables — reader', () => {
  beforeEach(() => vi.mocked(httpsCallable).mockReset());

  it('returns the answer for a queryFn', async () => {
    mockCallable({ rows: [1] });
    const useRead = createCallables(makePolicy()).createCallableReader<
      { q: string },
      { rows: number[] }
    >('read');
    const { result } = renderHook(() => useRead());

    await expect(result.current({ q: 'x' })).resolves.toEqual({ rows: [1] });
  });

  it('a failure rejects without a toast and is never captured here', async () => {
    const error = fault();
    mockCallable(throwing(error));
    const policy = makePolicy();
    const useRead = createCallables(policy).createCallableReader<void, unknown>('read');
    const { result } = renderHook(() => useRead());

    await expect(result.current()).rejects.toBe(error);

    expect(policy.captureFault).not.toHaveBeenCalled();
    expect(policy.captureRecoveredFallback).not.toHaveBeenCalled();
    expect(policy.onActionError).toHaveBeenCalledTimes(1);
    expect(policy.onActionError).toHaveBeenCalledWith(error, {
      showErrorToast: false,
      answeredRefusals: [],
      isAnswerSurfacedByCaller: undefined,
    });
  });
});

describe('createCallables — recovered limited-use fallback', () => {
  beforeEach(() => vi.mocked(httpsCallable).mockReset());

  const throttled = () => fault('appCheck/throttled');
  const FALLBACK_REPORT = {
    functionName: 'sensitiveRead',
    timeoutMs: TIMEOUT_MS,
    limitedUseAppCheckFallback: true,
  };

  it('a reader whose throttled limited-use call recovers hands that report, and only it, to captureRecoveredFallback', async () => {
    const error = throttled();
    mockCallable(throwing(error), { rows: [] });
    const policy = makePolicy();
    const useRead = createCallables(policy).createCallableReader<void, unknown>('sensitiveRead', {
      limitedUseAppCheck: true,
    });
    const { result } = renderHook(() => useRead());

    await expect(result.current()).resolves.toEqual({ rows: [] });

    expect(policy.captureRecoveredFallback).toHaveBeenCalledTimes(1);
    expect(policy.captureRecoveredFallback).toHaveBeenCalledWith(error, FALLBACK_REPORT);
    expect(policy.captureFault).not.toHaveBeenCalled();
    expect(policy.onActionError).not.toHaveBeenCalled();
  });

  it('a reader whose fallback retry fails too hands over the recovered report but never the failure', async () => {
    const throttle = throttled();
    const retryFailure = fault('functions/unavailable');
    mockCallable(throwing(throttle), throwing(retryFailure));
    const policy = makePolicy();
    const useRead = createCallables(policy).createCallableReader<void, unknown>('sensitiveRead', {
      limitedUseAppCheck: true,
    });
    const { result } = renderHook(() => useRead());

    await expect(result.current()).rejects.toBe(retryFailure);

    expect(policy.captureRecoveredFallback).toHaveBeenCalledTimes(1);
    expect(policy.captureRecoveredFallback).toHaveBeenCalledWith(throttle, FALLBACK_REPORT);
    expect(policy.captureFault).not.toHaveBeenCalled();
  });

  it('an action that owns its capture hands the recovered report to captureFault', async () => {
    const error = throttled();
    mockCallable(throwing(error), { ok: true });
    const policy = makePolicy();
    const useAction = createCallables(policy).createCallableHook<void, unknown>('sensitiveRead', {
      limitedUseAppCheck: true,
    });
    const { result } = renderHook(() => useAction(), { wrapper: wrapperFor(retryingClient()) });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(policy.captureFault).toHaveBeenCalledTimes(1);
    expect(policy.captureFault).toHaveBeenCalledWith(error, FALLBACK_REPORT);
    expect(policy.captureRecoveredFallback).not.toHaveBeenCalled();
  });
});

describe('createCallables — invoker', () => {
  beforeEach(() => vi.mocked(httpsCallable).mockReset());

  it('re-throws a failure after routing it and capturing the fault exactly once', async () => {
    const error = fault();
    mockCallable(throwing(error));
    const policy = makePolicy();
    const useInvoke = createCallables(policy).createCallableInvoker<{ id: string }, unknown>(
      'archive',
    );
    const { result } = renderHook(() => useInvoke());

    await expect(result.current({ id: 'n1' })).rejects.toBe(error);

    expect(policy.onActionError).toHaveBeenCalledTimes(1);
    expect(policy.onActionError).toHaveBeenCalledWith(error, DEFAULT_ROUTING);
    expect(policy.captureFault).toHaveBeenCalledTimes(1);
    expect(policy.captureRecoveredFallback).not.toHaveBeenCalled();
  });
});

describe('createCallables — resumable', () => {
  beforeEach(() => vi.mocked(httpsCallable).mockReset());

  type Progress = { complete: boolean; removed: number };
  const sumRemoved = (earlier: Progress, later: Progress): Progress => ({
    complete: later.complete,
    removed: earlier.removed + later.removed,
  });

  function renderResumable(policy = makePolicy()) {
    const useResumable = createCallables(policy).createResumableCallableHook<
      { id: string },
      Progress
    >('removeAll', sumRemoved);
    return renderHook(() => useResumable(), { wrapper: wrapperFor(retryingClient()) });
  }

  it('calls again with the same input until the answer is complete, merging every answer', async () => {
    const invoke = mockCallable(
      { complete: false, removed: 2 },
      { complete: false, removed: 3 },
      { complete: true, removed: 1 },
      { complete: true, removed: 100 },
    );
    const { result } = renderResumable();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ id: 'g' });
    });

    expect(invoke).toHaveBeenCalledTimes(3);
    for (const call of invoke.mock.calls) expect(call[0]).toEqual({ id: 'g' });
    expect(outcome).toEqual({ complete: true, removed: 6, interruption: null });
  });

  it('stops at the call cap and settles on the merged progress, not complete', async () => {
    const invoke = mockCallable(
      ...Array.from({ length: MAX_RESUMABLE_CALLS + 2 }, () => ({ complete: false, removed: 1 })),
    );
    const { result } = renderResumable();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ id: 'g' });
    });

    expect(invoke).toHaveBeenCalledTimes(MAX_RESUMABLE_CALLS);
    expect(outcome).toEqual({ complete: false, removed: MAX_RESUMABLE_CALLS, interruption: null });
  });

  it('a later call failing keeps the earlier work and settles on it beside the failure', async () => {
    const error = fault('functions/unavailable');
    const invoke = mockCallable(
      { complete: false, removed: 2 },
      { complete: false, removed: 3 },
      throwing(error),
      { complete: true, removed: 100 },
    );
    const policy = makePolicy();
    const { result } = renderResumable(policy);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ id: 'g' });
    });

    expect(invoke).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ complete: false, removed: 5, interruption: error });
    expect(policy.onActionError).toHaveBeenCalledTimes(1);
    expect(policy.captureFault).toHaveBeenCalledTimes(1);
  });

  it('a merge that throws rejects the request instead of settling as an interruption', async () => {
    const mergeFault = new Error('merge broke');
    const invoke = mockCallable({ complete: false, removed: 2 }, { complete: true, removed: 3 });
    const policy = makePolicy();
    const useResumable = createCallables(policy).createResumableCallableHook<
      { id: string },
      Progress
    >('removeAll', () => {
      throw mergeFault;
    });
    const { result } = renderHook(() => useResumable(), { wrapper: wrapperFor(retryingClient()) });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'g' })).rejects.toBe(mergeFault);
    });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(policy.onActionError).not.toHaveBeenCalled();
    expect(policy.captureFault).not.toHaveBeenCalled();
  });

  it('a first call failing rejects the request and is not retried', async () => {
    const error = fault();
    const invoke = mockCallable(throwing(error), { complete: true, removed: 1 });
    const policy = makePolicy();
    const { result } = renderResumable(policy);

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'g' })).rejects.toBe(error);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(policy.captureFault).toHaveBeenCalledTimes(1);
    expect(policy.onActionError).toHaveBeenCalledTimes(1);
  });
});
