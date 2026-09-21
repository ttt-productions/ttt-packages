// The undefined-strip contract (regression for the live 2026-07-12 failure):
// firebase-js-sdk's callable serializer encodes `undefined` as `null` on the wire,
// so a payload key with an undefined value arrives server-side as null and strict
// zod schemas (`field: z.string().optional()` — optional, NOT nullable) reject it.
// callCallable is the ONE invocation primitive and must drop undefined keys deep.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeSpy = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => invokeSpy),
}));

import { callCallable, stripUndefinedDeep } from "../src/client/call-callable.js";
import { httpsCallable, type Functions } from "firebase/functions";

const fakeFunctions = {} as Functions;

beforeEach(() => {
  invokeSpy.mockReset();
  invokeSpy.mockResolvedValue({ data: { ok: true } });
});

describe("stripUndefinedDeep", () => {
  it("drops undefined-valued keys and keeps everything else, deeply", () => {
    expect(
      stripUndefinedDeep({
        a: 1,
        b: undefined,
        c: null,
        d: { e: undefined, f: "x", g: [{ h: undefined, i: 0 }] },
      }),
    ).toEqual({ a: 1, c: null, d: { f: "x", g: [{ i: 0 }] } });
  });

  it("preserves explicit null (only undefined is a transport artifact)", () => {
    expect(stripUndefinedDeep({ reason: null })).toEqual({ reason: null });
  });

  it("passes class instances through untouched (the SDK owns their encoding)", () => {
    const when = new Date(0);
    const stripped = stripUndefinedDeep({ when, note: undefined });
    expect(stripped).toEqual({ when });
    expect(stripped.when).toBe(when);
  });

  it("handles arrays, primitives, and undefined itself", () => {
    expect(stripUndefinedDeep([1, { a: undefined }, "x"])).toEqual([1, {}, "x"]);
    expect(stripUndefinedDeep("s")).toBe("s");
    expect(stripUndefinedDeep(undefined)).toBeUndefined();
  });
});

describe("callCallable", () => {
  it("invokes with the STRIPPED payload — an omitted optional never rides as undefined", async () => {
    await callCallable(fakeFunctions, "setUserStatus", {
      userId: "u1",
      status: "active",
      reason: undefined,
    });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const sent = invokeSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(["status", "userId"]);
    expect("reason" in sent).toBe(false);
  });

  it("returns result.data and fires no callbacks on success", async () => {
    const onError = vi.fn();
    const captureException = vi.fn();
    const out = await callCallable(fakeFunctions, "fn", { a: 1 }, { onError, captureException });
    expect(out).toEqual({ ok: true });
    expect(onError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("fires captureException (payload-free) + onError (with payload) and re-throws on failure", async () => {
    const boom = new Error("nope");
    invokeSpy.mockRejectedValueOnce(boom);
    const onError = vi.fn();
    const captureException = vi.fn();
    await expect(
      callCallable(fakeFunctions, "fn", { a: 1 }, { onError, captureException }),
    ).rejects.toThrow("nope");
    // Telemetry channel gets bounded metadata ONLY — the request payload must
    // never reach captureException (it can forward straight to Sentry).
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(boom, { functionName: "fn", timeoutMs: undefined });
    expect("requestData" in (captureException.mock.calls[0][1] as Record<string, unknown>)).toBe(false);
    // Caller-local channel keeps the payload (existing contract).
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(boom, { functionName: "fn", requestData: { a: 1 } });
  });
});

// The total-invocation deadline (CallCallableTransport.timeoutMs): starts BEFORE
// the SDK is invoked, so it also bounds the SDK's pre-transport auth/App Check
// phase (the SDK's own timer starts only after that phase — a stalled token mint
// otherwise waits unbounded). Expiry is a giving-up signal, not cancellation.
describe("callCallable deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("forwards the timeout to the SDK when supplied, and omits options when not", async () => {
    await callCallable(fakeFunctions, "fn", { a: 1 }, undefined, { timeoutMs: 45_000 });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(fakeFunctions, "fn", { timeout: 45_000 });
    await callCallable(fakeFunctions, "fn", { a: 1 });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(fakeFunctions, "fn", undefined);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid timeoutMs %s with a TypeError before invoking anything",
    async (bad) => {
      invokeSpy.mockClear();
      await expect(
        callCallable(fakeFunctions, "fn", {}, undefined, { timeoutMs: bad }),
      ).rejects.toThrow(TypeError);
      expect(invokeSpy).not.toHaveBeenCalled();
    },
  );

  it("settles a never-settling invocation at the deadline with a Firebase-shaped error", async () => {
    // A promise that never settles models the SDK stuck ANYWHERE — including
    // the pre-transport auth/App Check phase its own timer does not cover.
    invokeSpy.mockReturnValueOnce(new Promise(() => {}));
    const call = callCallable(fakeFunctions, "hangs", { a: 1 }, undefined, { timeoutMs: 1_000 });
    const assertion = expect(call).rejects.toMatchObject({
      name: "FirebaseError",
      code: "functions/deadline-exceeded",
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("deadline expiry fires captureException once (payload-free) and onError once (with payload)", async () => {
    invokeSpy.mockReturnValueOnce(new Promise(() => {}));
    const onError = vi.fn();
    const captureException = vi.fn();
    const call = callCallable(fakeFunctions, "hangs", { secret: "x" }, { onError, captureException }, { timeoutMs: 1_000 });
    const assertion = expect(call).rejects.toMatchObject({ code: "functions/deadline-exceeded" });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ code: "functions/deadline-exceeded" }), {
      functionName: "hangs",
      timeoutMs: 1_000,
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "functions/deadline-exceeded" }), {
      functionName: "hangs",
      requestData: { secret: "x" },
    });
  });

  it("clears the timer on success and on SDK failure (no timer survives settlement)", async () => {
    invokeSpy.mockResolvedValueOnce({ data: { ok: true } });
    await callCallable(fakeFunctions, "fn", {}, undefined, { timeoutMs: 60_000 });
    expect(vi.getTimerCount()).toBe(0);

    invokeSpy.mockRejectedValueOnce(new Error("sdk failed"));
    await expect(
      callCallable(fakeFunctions, "fn", {}, undefined, { timeoutMs: 60_000 }),
    ).rejects.toThrow("sdk failed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a post-deadline SDK settlement never becomes an unhandled rejection", async () => {
    // The SDK's own (later-started) timer can reject AFTER the outer deadline
    // already won the race — that late rejection must have a consumer.
    invokeSpy.mockReturnValueOnce(
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("late SDK rejection")), 3_000);
      }),
    );
    const call = callCallable(fakeFunctions, "hangs", {}, undefined, { timeoutMs: 1_000 });
    const assertion = expect(call).rejects.toMatchObject({ code: "functions/deadline-exceeded" });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    // Fire the late rejection inside this test — vitest fails the test if it
    // surfaces as unhandled.
    await vi.advanceTimersByTimeAsync(3_000);
  });
});

// The limited-use App Check opt-in (CallCallableTransport.limitedUseAppCheck):
// OPTIONAL and default-false. It maps to the SDK's `limitedUseAppCheckTokens`,
// which mints a single-use token per call so a backend running
// `consumeAppCheckToken` can REFUSE a replay instead of only recording one.
// Absent unless explicitly enabled — existing callers must be unaffected.
describe("callCallable limited-use App Check", () => {
  it("sets limitedUseAppCheckTokens on the SDK options when enabled", async () => {
    await callCallable(fakeFunctions, "fn", { a: 1 }, undefined, { limitedUseAppCheck: true });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(fakeFunctions, "fn", {
      limitedUseAppCheckTokens: true,
    });
  });

  it("omits the flag entirely when unset, false, or the transport is absent", async () => {
    await callCallable(fakeFunctions, "fn", { a: 1 }, undefined, { limitedUseAppCheck: false });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(fakeFunctions, "fn", undefined);

    await callCallable(fakeFunctions, "fn", { a: 1 }, undefined, {});
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(fakeFunctions, "fn", undefined);

    await callCallable(fakeFunctions, "fn", { a: 1 });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(fakeFunctions, "fn", undefined);
  });

  it("combines with the deadline without either option dropping the other", async () => {
    await callCallable(fakeFunctions, "fn", { a: 1 }, undefined, {
      timeoutMs: 30_000,
      limitedUseAppCheck: true,
    });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(fakeFunctions, "fn", {
      timeout: 30_000,
      limitedUseAppCheckTokens: true,
    });
  });

  it("timeout alone still carries no App Check flag", async () => {
    await callCallable(fakeFunctions, "fn", { a: 1 }, undefined, { timeoutMs: 30_000 });
    const opts = vi.mocked(httpsCallable).mock.lastCall?.[2] as Record<string, unknown>;
    expect(opts).toEqual({ timeout: 30_000 });
    expect("limitedUseAppCheckTokens" in opts).toBe(false);
  });
});

// The limited-use App Check THROTTLE FALLBACK. The SDK's limited-use path calls
// the App Check provider's getToken() with no catch, so one failed exchange puts
// the provider into its backoff window and every later limited-use invocation
// rejects (`appCheck/initial-throttle`, then `appCheck/throttled`) BEFORE
// reaching the wire. callCallable retries exactly once on the standard cached
// token — safe against double submission precisely because nothing was sent.
describe("callCallable limited-use App Check throttle fallback", () => {
  const throttleError = (code: string) => Object.assign(new Error(code), { code });

  it.each(["appCheck/throttled", "appCheck/initial-throttle"])(
    "retries once WITHOUT the limited-use option after %s and returns the retry's data",
    async (code) => {
      vi.mocked(httpsCallable).mockClear();
      invokeSpy.mockRejectedValueOnce(throttleError(code));
      invokeSpy.mockResolvedValueOnce({ data: { ok: "fallback" } });

      const out = await callCallable(fakeFunctions, "fn", { a: 1 }, undefined, {
        limitedUseAppCheck: true,
      });

      expect(out).toEqual({ ok: "fallback" });
      expect(invokeSpy).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(httpsCallable).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][2]).toEqual({ limitedUseAppCheckTokens: true });
      // The retry takes the standard cached-token path: the option is ABSENT.
      expect(calls[1][2]).toBeUndefined();
    },
  );

  it("reports the fallback through captureException with the flag and no payload", async () => {
    const thrown = throttleError("appCheck/throttled");
    invokeSpy.mockRejectedValueOnce(thrown);
    invokeSpy.mockResolvedValueOnce({ data: { ok: true } });
    const onError = vi.fn();
    const captureException = vi.fn();

    await callCallable(
      fakeFunctions,
      "fn",
      { secret: "x" },
      { onError, captureException },
      { limitedUseAppCheck: true, timeoutMs: 30_000 },
    );

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(thrown, {
      functionName: "fn",
      timeoutMs: 30_000,
      limitedUseAppCheckFallback: true,
    });
    const ctx = captureException.mock.calls[0][1] as Record<string, unknown>;
    expect("requestData" in ctx).toBe(false);
    expect(JSON.stringify(ctx)).not.toContain("secret");
    // A recovered call is not a caller-visible failure.
    expect(onError).not.toHaveBeenCalled();
  });

  it("sends the same stripped payload on the retry", async () => {
    invokeSpy.mockRejectedValueOnce(throttleError("appCheck/throttled"));
    invokeSpy.mockResolvedValueOnce({ data: { ok: true } });
    await callCallable(
      fakeFunctions,
      "fn",
      { userId: "u1", reason: undefined },
      undefined,
      { limitedUseAppCheck: true },
    );
    expect(invokeSpy.mock.calls[1][0]).toEqual({ userId: "u1" });
  });

  it("never falls back when limited-use was not requested", async () => {
    invokeSpy.mockRejectedValueOnce(throttleError("appCheck/throttled"));
    const captureException = vi.fn();
    await expect(
      callCallable(fakeFunctions, "fn", { a: 1 }, { captureException }),
    ).rejects.toMatchObject({ code: "appCheck/throttled" });
    expect(invokeSpy).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toEqual({ functionName: "fn", timeoutMs: undefined });
  });

  it("never falls back for any other error class", async () => {
    for (const code of ["functions/internal", "functions/failed-precondition", "appCheck/fetch-status-error"]) {
      invokeSpy.mockReset();
      invokeSpy.mockRejectedValueOnce(throttleError(code));
      await expect(
        callCallable(fakeFunctions, "fn", { a: 1 }, undefined, { limitedUseAppCheck: true }),
      ).rejects.toMatchObject({ code });
      expect(invokeSpy).toHaveBeenCalledTimes(1);
    }
  });

  it("retries at most once — a second throttle from the fallback surfaces as-is", async () => {
    invokeSpy.mockRejectedValueOnce(throttleError("appCheck/initial-throttle"));
    invokeSpy.mockRejectedValueOnce(throttleError("appCheck/throttled"));
    await expect(
      callCallable(fakeFunctions, "fn", { a: 1 }, undefined, { limitedUseAppCheck: true }),
    ).rejects.toMatchObject({ code: "appCheck/throttled" });
    expect(invokeSpy).toHaveBeenCalledTimes(2);
  });

  it("surfaces the RETRY's error with the failure callbacks fired once for it", async () => {
    const retryFailure = Object.assign(new Error("retry blew up"), { code: "functions/internal" });
    invokeSpy.mockRejectedValueOnce(throttleError("appCheck/throttled"));
    invokeSpy.mockRejectedValueOnce(retryFailure);
    const onError = vi.fn();
    const captureException = vi.fn();

    await expect(
      callCallable(fakeFunctions, "fn", { a: 1 }, { onError, captureException }, { limitedUseAppCheck: true }),
    ).rejects.toThrow("retry blew up");

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(retryFailure, { functionName: "fn", requestData: { a: 1 } });
    // Exactly one FAILURE report for the retry's error, alongside the single
    // informational fallback report — no duplicate capture of the final failure.
    const failureReports = captureException.mock.calls.filter(
      ([, ctx]) => (ctx as Record<string, unknown>).limitedUseAppCheckFallback !== true,
    );
    expect(failureReports).toHaveLength(1);
    expect(failureReports[0][0]).toBe(retryFailure);
    expect(failureReports[0][1]).toEqual({ functionName: "fn", timeoutMs: undefined });
  });

  it("bounds BOTH attempts with the one deadline — the timer is never restarted", async () => {
    vi.useFakeTimers();
    try {
      invokeSpy.mockReset();
      // First attempt throttles immediately; the retry hangs forever. The
      // deadline must still expire on the ORIGINAL schedule.
      invokeSpy.mockRejectedValueOnce(throttleError("appCheck/throttled"));
      invokeSpy.mockReturnValueOnce(new Promise(() => {}));
      const call = callCallable(fakeFunctions, "hangs", { a: 1 }, undefined, {
        limitedUseAppCheck: true,
        timeoutMs: 1_000,
      });
      const assertion = expect(call).rejects.toMatchObject({
        name: "FirebaseError",
        code: "functions/deadline-exceeded",
      });
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
      expect(invokeSpy).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a deadline expiry on the first attempt is never treated as a throttle", async () => {
    vi.useFakeTimers();
    try {
      invokeSpy.mockReset();
      invokeSpy.mockReturnValueOnce(new Promise(() => {}));
      const call = callCallable(fakeFunctions, "hangs", { a: 1 }, undefined, {
        limitedUseAppCheck: true,
        timeoutMs: 1_000,
      });
      const assertion = expect(call).rejects.toMatchObject({ code: "functions/deadline-exceeded" });
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
      expect(invokeSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
