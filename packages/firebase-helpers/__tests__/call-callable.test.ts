import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Functions, HttpsCallableOptions } from 'firebase/functions';
import { CustomProvider, initializeAppCheck } from 'firebase/app-check';
import { callableServer } from './helpers/callable-server.js';

const calls = vi.hoisted(() => {
  const created: Array<{ functions: Functions; name: string; options?: HttpsCallableOptions }> = [];
  const invoked: unknown[] = [];
  return { created, invoked };
});

vi.mock('firebase/functions', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  type FunctionsModule = typeof import('firebase/functions');
  const actual = await importOriginal<FunctionsModule>();
  return passThroughModule<FunctionsModule>(importOriginal, {
    httpsCallable: <RequestData, ResponseData, StreamData>(
      functions: Functions,
      name: string,
      options?: HttpsCallableOptions,
    ) => {
      calls.created.push({ functions, name, options });
      const callable = actual.httpsCallable<RequestData, ResponseData, StreamData>(
        functions,
        name,
        options,
      );
      return Object.assign(
        (data?: RequestData | null) => {
          calls.invoked.push(data);
          return callable(data);
        },
        { stream: callable.stream },
      );
    },
  });
});

import { getFunctions } from 'firebase/functions';
import { callCallable, stripUndefinedDeep } from '../src/client/call-callable.js';

// The real app SDK, though the shared test setup mocks 'firebase/app'.
const { initializeApp, FirebaseError } =
  await vi.importActual<typeof import('firebase/app')>('firebase/app');

const app = initializeApp(
  { apiKey: 'k', projectId: 'demo-call-callable', appId: '1:1:web:1' },
  'call-callable',
);
const appCheckFailures: Error[] = [];
initializeAppCheck(app, {
  provider: new CustomProvider({
    getToken: async () => {
      const failure = appCheckFailures.shift();
      if (failure) throw failure;
      return { token: 'app-check-token', expireTimeMillis: Date.now() + 3_600_000 };
    },
  }),
  isTokenAutoRefreshEnabled: false,
});
const functions = getFunctions(app);
const getFunctionsInstance = () => functions;
const server = callableServer();

const throttleError = (code: string) => new FirebaseError(code, `AppCheck: ${code}`);
const serverError = (status: string, message: string) => ({
  error: { status, message, httpStatus: status === 'FAILED_PRECONDITION' ? 400 : 500 },
});

beforeEach(() => {
  calls.created.length = 0;
  calls.invoked.length = 0;
  appCheckFailures.length = 0;
  server.reset();
  vi.stubGlobal('fetch', server.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stripUndefinedDeep', () => {
  it('drops undefined-valued keys and keeps everything else, deeply', () => {
    expect(
      stripUndefinedDeep({
        a: 1,
        b: undefined,
        c: null,
        d: { e: undefined, f: 'x', g: [{ h: undefined, i: 0 }] },
      }),
    ).toEqual({ a: 1, c: null, d: { f: 'x', g: [{ i: 0 }] } });
  });

  it('preserves explicit null (only undefined is a transport artifact)', () => {
    expect(stripUndefinedDeep({ reason: null })).toEqual({ reason: null });
  });

  it('passes class instances through untouched (the SDK owns their encoding)', () => {
    const when = new Date(0);
    const stripped = stripUndefinedDeep({ when, note: undefined });
    expect(stripped).toEqual({ when });
    expect(stripped.when).toBe(when);
  });

  it('handles arrays, primitives, and undefined itself', () => {
    expect(stripUndefinedDeep([1, { a: undefined }, 'x'])).toEqual([1, {}, 'x']);
    expect(stripUndefinedDeep('s')).toBe('s');
    expect(stripUndefinedDeep(undefined)).toBeUndefined();
  });
});

describe('callCallable', () => {
  it('invokes with the STRIPPED payload — an omitted optional never rides as undefined', async () => {
    await callCallable(getFunctionsInstance, 'setUserStatus', {
      userId: 'u1',
      status: 'active',
      reason: undefined,
    });
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0].data).toEqual({ userId: 'u1', status: 'active' });
  });

  it('returns result.data and fires no callbacks on success', async () => {
    const onError = vi.fn();
    const captureException = vi.fn();
    const out = await callCallable(
      getFunctionsInstance,
      'fn',
      { a: 1 },
      { onError, captureException },
    );
    expect(out).toEqual({ ok: true });
    expect(onError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('fires captureException (payload-free) + onError (with payload) and re-throws on failure', async () => {
    server.answer(serverError('INTERNAL', 'nope'));
    const onError = vi.fn();
    const captureException = vi.fn();
    const failure: unknown = await callCallable(
      getFunctionsInstance,
      'fn',
      { a: 1 },
      { onError, captureException },
    ).catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'functions/internal' });
    expect(failure instanceof Error && failure.message).toContain('nope');
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(failure, {
      functionName: 'fn',
      timeoutMs: undefined,
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure, { functionName: 'fn', requestData: { a: 1 } });
  });
});

describe('callCallable deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forwards the timeout to the SDK when supplied, and omits options when not', async () => {
    await callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, { timeoutMs: 45_000 });
    expect(calls.created.at(-1)).toEqual({ functions, name: 'fn', options: { timeout: 45_000 } });
    await callCallable(getFunctionsInstance, 'fn', { a: 1 });
    expect(calls.created.at(-1)).toEqual({ functions, name: 'fn', options: undefined });
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid timeoutMs %s with a TypeError before invoking anything',
    async (bad) => {
      await expect(
        callCallable(getFunctionsInstance, 'fn', {}, undefined, { timeoutMs: bad }),
      ).rejects.toThrow(TypeError);
      expect(calls.invoked).toHaveLength(0);
    },
  );

  it('settles a never-settling invocation at the deadline with a Firebase-shaped error', async () => {
    server.answer('hang');
    const call = callCallable(getFunctionsInstance, 'hangs', { a: 1 }, undefined, {
      timeoutMs: 1_000,
    });
    const assertion = expect(call).rejects.toMatchObject({
      name: 'FirebaseError',
      code: 'functions/deadline-exceeded',
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it('deadline expiry fires captureException once (payload-free) and onError once (with payload)', async () => {
    server.answer('hang');
    const onError = vi.fn();
    const captureException = vi.fn();
    const call = callCallable(
      getFunctionsInstance,
      'hangs',
      { secret: 'x' },
      { onError, captureException },
      { timeoutMs: 1_000 },
    );
    const assertion = expect(call).rejects.toMatchObject({ code: 'functions/deadline-exceeded' });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'functions/deadline-exceeded' }),
      {
        functionName: 'hangs',
        timeoutMs: 1_000,
      },
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'functions/deadline-exceeded' }),
      {
        functionName: 'hangs',
        requestData: { secret: 'x' },
      },
    );
  });

  it('clears the timer on success and on SDK failure (no timer survives settlement)', async () => {
    await callCallable(getFunctionsInstance, 'fn', {}, undefined, { timeoutMs: 60_000 });
    expect(vi.getTimerCount()).toBe(0);

    server.answer(serverError('INTERNAL', 'sdk failed'));
    await expect(
      callCallable(getFunctionsInstance, 'fn', {}, undefined, { timeoutMs: 60_000 }),
    ).rejects.toThrow('sdk failed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a post-deadline SDK settlement never becomes an unhandled rejection', async () => {
    server.answer('hang');
    const call = callCallable(getFunctionsInstance, 'hangs', {}, undefined, { timeoutMs: 1_000 });
    const assertion = expect(call).rejects.toMatchObject({ code: 'functions/deadline-exceeded' });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    // The SDK's own timeout rejects the invocation after the deadline already settled the call; run
    // it inside this test, since vitest fails a test whose rejection goes unhandled.
    await vi.advanceTimersByTimeAsync(3_000);
  });
});

describe('callCallable limited-use App Check', () => {
  it('sets limitedUseAppCheckTokens on the SDK options when enabled', async () => {
    await callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, {
      limitedUseAppCheck: true,
    });
    expect(calls.created.at(-1)?.options).toEqual({ limitedUseAppCheckTokens: true });
    expect(server.requests.at(-1)?.appCheckToken).toBe('app-check-token');
  });

  it('omits the flag entirely when unset, false, or the transport is absent', async () => {
    await callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, {
      limitedUseAppCheck: false,
    });
    expect(calls.created.at(-1)?.options).toBeUndefined();

    await callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, {});
    expect(calls.created.at(-1)?.options).toBeUndefined();

    await callCallable(getFunctionsInstance, 'fn', { a: 1 });
    expect(calls.created.at(-1)?.options).toBeUndefined();
  });

  it('combines with the deadline without either option dropping the other', async () => {
    await callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, {
      timeoutMs: 30_000,
      limitedUseAppCheck: true,
    });
    expect(calls.created.at(-1)?.options).toEqual({
      timeout: 30_000,
      limitedUseAppCheckTokens: true,
    });
  });

  it('timeout alone still carries no App Check flag', async () => {
    await callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, { timeoutMs: 30_000 });
    expect(calls.created.at(-1)?.options).toEqual({ timeout: 30_000 });
  });
});

describe('callCallable limited-use App Check throttle fallback', () => {
  it.each(['appCheck/throttled', 'appCheck/initial-throttle'])(
    "retries once WITHOUT the limited-use option after %s and returns the retry's data",
    async (code) => {
      appCheckFailures.push(throttleError(code));
      server.answer({ data: { ok: 'fallback' } });

      const out = await callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, {
        limitedUseAppCheck: true,
      });

      expect(out).toEqual({ ok: 'fallback' });
      expect(calls.invoked).toHaveLength(2);
      expect(calls.created.map(({ options }) => options)).toEqual([
        { limitedUseAppCheckTokens: true },
        undefined,
      ]);
      expect(server.requests).toHaveLength(1);
    },
  );

  it('reports the fallback through captureException with the flag and no payload', async () => {
    const thrown = throttleError('appCheck/throttled');
    appCheckFailures.push(thrown);
    const onError = vi.fn();
    const captureException = vi.fn();

    await callCallable(
      getFunctionsInstance,
      'fn',
      { secret: 'x' },
      { onError, captureException },
      { limitedUseAppCheck: true, timeoutMs: 30_000 },
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(thrown, {
      functionName: 'fn',
      timeoutMs: 30_000,
      limitedUseAppCheckFallback: true,
    });
    const ctx = captureException.mock.calls[0][1] as Record<string, unknown>;
    expect('requestData' in ctx).toBe(false);
    expect(JSON.stringify(ctx)).not.toContain('secret');
    expect(onError).not.toHaveBeenCalled();
  });

  it('sends the same stripped payload on the retry', async () => {
    appCheckFailures.push(throttleError('appCheck/throttled'));
    await callCallable(getFunctionsInstance, 'fn', { userId: 'u1', reason: undefined }, undefined, {
      limitedUseAppCheck: true,
    });
    expect(calls.invoked[1]).toEqual({ userId: 'u1' });
    expect(server.requests[0].data).toEqual({ userId: 'u1' });
  });

  it('never falls back for any other error class', async () => {
    const failures: Array<{ code: string; arrange: () => void }> = [
      { code: 'functions/internal', arrange: () => server.answer(serverError('INTERNAL', 'x')) },
      {
        code: 'functions/failed-precondition',
        arrange: () => server.answer(serverError('FAILED_PRECONDITION', 'x')),
      },
      {
        code: 'appCheck/fetch-status-error',
        arrange: () => appCheckFailures.push(throttleError('appCheck/fetch-status-error')),
      },
    ];
    for (const { code, arrange } of failures) {
      calls.invoked.length = 0;
      arrange();
      await expect(
        callCallable(getFunctionsInstance, 'fn', { a: 1 }, undefined, {
          limitedUseAppCheck: true,
        }),
      ).rejects.toMatchObject({ code });
      expect(calls.invoked).toHaveLength(1);
    }
  });

  it("surfaces the RETRY's error with the failure callbacks fired once for it", async () => {
    appCheckFailures.push(throttleError('appCheck/throttled'));
    server.answer(serverError('INTERNAL', 'retry blew up'));
    const onError = vi.fn();
    const captureException = vi.fn();

    const retryFailure: unknown = await callCallable(
      getFunctionsInstance,
      'fn',
      { a: 1 },
      { onError, captureException },
      { limitedUseAppCheck: true },
    ).catch((error: unknown) => error);

    expect(retryFailure).toMatchObject({ code: 'functions/internal' });
    expect(retryFailure instanceof Error && retryFailure.message).toContain('retry blew up');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(retryFailure, {
      functionName: 'fn',
      requestData: { a: 1 },
    });
    const failureReports = captureException.mock.calls.filter(
      ([, ctx]) => (ctx as Record<string, unknown>).limitedUseAppCheckFallback !== true,
    );
    expect(failureReports).toHaveLength(1);
    expect(failureReports[0][0]).toBe(retryFailure);
    expect(failureReports[0][1]).toEqual({ functionName: 'fn', timeoutMs: undefined });
  });

  it('bounds BOTH attempts with the one deadline — the timer is never restarted', async () => {
    vi.useFakeTimers();
    try {
      appCheckFailures.push(throttleError('appCheck/throttled'));
      server.answer('hang');
      const call = callCallable(getFunctionsInstance, 'hangs', { a: 1 }, undefined, {
        limitedUseAppCheck: true,
        timeoutMs: 1_000,
      });
      const assertion = expect(call).rejects.toMatchObject({
        name: 'FirebaseError',
        code: 'functions/deadline-exceeded',
      });
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
      expect(calls.invoked).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a deadline expiry on the first attempt is never treated as a throttle', async () => {
    vi.useFakeTimers();
    try {
      server.answer('hang');
      const call = callCallable(getFunctionsInstance, 'hangs', { a: 1 }, undefined, {
        limitedUseAppCheck: true,
        timeoutMs: 1_000,
      });
      const assertion = expect(call).rejects.toMatchObject({ code: 'functions/deadline-exceeded' });
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
      expect(calls.invoked).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('callCallable — acquiring Functions from the provider', () => {
  it('accepts a lazy async provider and invokes with its instance', async () => {
    const out = await callCallable(async () => functions, 'fn', { a: 1 });
    expect(out).toEqual({ ok: true });
    expect(calls.created.at(-1)).toEqual({ functions, name: 'fn', options: undefined });
  });

  it('reports a provider with no instance once to capture and once to onError, then rejects', async () => {
    const onError = vi.fn();
    const captureException = vi.fn();
    await expect(
      callCallable(() => null, 'fn', { secret: 'x' }, { onError, captureException }),
    ).rejects.toThrow('Firebase Functions is not available');
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toEqual({ functionName: 'fn', timeoutMs: undefined });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toEqual({ functionName: 'fn', requestData: { secret: 'x' } });
    expect(calls.invoked).toHaveLength(0);
  });

  it('reports a throwing provider once to capture and once to onError, rethrowing its error', async () => {
    const thrown = new Error('init failed');
    const onError = vi.fn();
    const captureException = vi.fn();
    await expect(
      callCallable(
        () => {
          throw thrown;
        },
        'fn',
        {},
        { onError, captureException },
      ),
    ).rejects.toBe(thrown);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(thrown);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(thrown);
    expect(calls.invoked).toHaveLength(0);
  });
});

describe('callCallable — the provider and the deadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a provider that never answers once the deadline passes, reporting it once', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const captureException = vi.fn();
    const call = callCallable(
      () => new Promise<never>(() => {}),
      'fn',
      { a: 1 },
      { onError, captureException },
      {
        timeoutMs: 1_000,
      },
    );
    const assertion = expect(call).rejects.toMatchObject({ code: 'functions/deadline-exceeded' });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(calls.invoked).toHaveLength(0);
  });

  it('invokes the SDK in the same tick when the provider answers synchronously', () => {
    void callCallable(getFunctionsInstance, 'fn', { a: 1 });
    expect(calls.invoked).toHaveLength(1);
  });
});
