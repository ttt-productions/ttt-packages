// The undefined-strip contract (regression for the live 2026-07-12 failure):
// firebase-js-sdk's callable serializer encodes `undefined` as `null` on the wire,
// so a payload key with an undefined value arrives server-side as null and strict
// zod schemas (`field: z.string().optional()` — optional, NOT nullable) reject it.
// callCallable is the ONE invocation primitive and must drop undefined keys deep.

import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeSpy = vi.fn();
vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => invokeSpy),
}));

import { callCallable, stripUndefinedDeep } from "../src/client/call-callable.js";
import type { Functions } from "firebase/functions";

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

  it("fires captureException + onError with context and re-throws on failure", async () => {
    const boom = new Error("nope");
    invokeSpy.mockRejectedValueOnce(boom);
    const onError = vi.fn();
    const captureException = vi.fn();
    await expect(
      callCallable(fakeFunctions, "fn", { a: 1 }, { onError, captureException }),
    ).rejects.toThrow("nope");
    expect(captureException).toHaveBeenCalledWith(boom, { functionName: "fn", requestData: { a: 1 } });
    expect(onError).toHaveBeenCalledWith(boom, { functionName: "fn", requestData: { a: 1 } });
  });
});
