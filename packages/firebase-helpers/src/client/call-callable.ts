import {
  httpsCallable,
  type Functions,
  type HttpsCallable,
  type HttpsCallableOptions,
  type HttpsCallableResult,
} from "firebase/functions";

import { isAppCheckThrottleError } from "../utils/app-check-throttle.js";

export interface CallCallableCallbacks {
  /**
   * Called when a call throws. callCallable still re-throws after this fires.
   * Receives the request payload for CALLER-LOCAL handling (retry decisions,
   * form re-fill). Consumers must never forward `requestData` to telemetry —
   * the telemetry channel is `captureException`, which is payload-free.
   */
  onError?: (error: unknown, ctx: { functionName: string; requestData: unknown }) => void;
  /**
   * Optional structured error reporter (Sentry, etc.). Generic — no toast
   * semantics. Receives BOUNDED SAFE METADATA ONLY ({ functionName, timeoutMs }
   * — plus `limitedUseAppCheckFallback: true` on the one informational report
   * described in `limitedUseAppCheck`) — never the request payload, so callable
   * arguments cannot leak into telemetry systems.
   */
  captureException?: (error: unknown, ctx: Record<string, unknown>) => void;
}

export interface CallCallableTransport {
  /**
   * Total invocation deadline in milliseconds — measured from callCallable
   * entry through response settlement, COVERING the SDK's pre-transport phase
   * (auth + App Check token acquisition, which the SDK performs BEFORE starting
   * its own timer; a stalled token mint would otherwise wait unbounded). The
   * same value is also forwarded to the SDK's `timeout` option so the transport
   * leg stays bounded by the SDK's own mechanism.
   *
   * Expiry rejects with a Firebase-shaped error whose `code` is
   * `functions/deadline-exceeded`. Expiry is a CLIENT-SIDE giving-up signal
   * only: it cannot cancel work the SDK or backend already started, so the
   * server may still commit after the deadline — callers must treat the
   * outcome as UNKNOWN, never as a definite failure.
   *
   * No default: the package supplies the mechanism; the consuming app owns the
   * policy value.
   */
  timeoutMs?: number;
  /**
   * Mint a LIMITED-USE App Check token for this invocation instead of the
   * standard cached one (SDK option `limitedUseAppCheckTokens`). A limited-use
   * token is single-use, so a backend that sets `consumeAppCheckToken` can
   * actually REFUSE a replay rather than merely record one.
   *
   * COST: enabling this makes EVERY call on this path mint a fresh token — an
   * attestation round trip per call, not per session — so it is intended for
   * sensitive callable groups only, never as a blanket default.
   *
   * ROLLOUT ORDER: turning on handler-side `alreadyConsumed` refusal before the
   * consumers of that callable have adopted this option would reject legitimate
   * traffic, because a cached (non-limited-use) token presents as already
   * consumed. Adopt on the client first, verify, and only then refuse.
   *
   * THROTTLE FALLBACK: the limited-use path has no soft-failure of its own —
   * the SDK asks the App Check provider for a fresh token with no catch, so one
   * failed exchange puts the provider into its backoff window and every later
   * limited-use invocation rejects with `appCheck/throttled` before reaching
   * the wire. When that happens, callCallable retries the invocation EXACTLY
   * ONCE with this option omitted, which takes the standard cached-token path
   * (that path returns a valid cached token without touching the provider).
   * The retry is reported through `captureException` and stays inside the same
   * `timeoutMs` deadline.
   *
   * ROLLOUT CAVEAT for that fallback: it works only while server-side token
   * consumption is RECORD-ONLY. Once a handler arms `alreadyConsumed` refusal,
   * a reused standard token would be refused, so the fallback must be revisited
   * at that point.
   *
   * Defaults to false (absent): the SDK option is omitted entirely unless this
   * is `true`, so existing callers are byte-for-byte unaffected.
   */
  limitedUseAppCheck?: boolean;
}

/**
 * Drop `undefined`-valued keys (deep) from a callable payload.
 *
 * firebase-js-sdk's callable serializer encodes `undefined` as `null` on the wire
 * (@firebase/functions `encode()`: `if (data == null) return null` — and it maps
 * EVERY key, so `{ reason: undefined }` arrives server-side as `{ reason: null }`).
 * Strict zod input schemas with `field: z.string().optional()` (optional, NOT
 * nullable) then reject with invalid-argument "expected string, received null".
 * Absent must mean ABSENT on the wire — exactly what optional TS types promise.
 *
 * Only plain objects and arrays are traversed; class instances (Date, Blob, etc.)
 * pass through untouched so the SDK's own special-type encoding still applies.
 * Explicit `null` is preserved — only `undefined` is a transport artifact.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as unknown as T;
  }
  if (
    value !== null &&
    typeof value === "object" &&
    (value as object).constructor === Object
  ) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefinedDeep(v)]),
    ) as T;
  }
  return value;
}

/** Firebase-shaped deadline error: consumers classify on `code`, same as SDK errors. */
function deadlineExceededError(functionName: string, timeoutMs: number): Error {
  const error = new Error(
    `deadline-exceeded: ${functionName} did not settle within ${timeoutMs}ms (outcome unknown — the server may still complete the request)`,
  );
  error.name = "FirebaseError";
  (error as Error & { code: string }).code = "functions/deadline-exceeded";
  return error;
}

/**
 * Invoke a Firebase Callable Function — the ONE shared invocation primitive.
 * `useCallableMutation` (./react) delegates here; non-hook contexts (pre-auth
 * flows, plain modules) call it directly. Owns the undefined-strip (see
 * stripUndefinedDeep), the generic error-callback contract, and the optional
 * total-invocation deadline, and the limited-use App Check opt-in plus its
 * one-shot throttle fallback (see CallCallableTransport); consumers own
 * toast/UX semantics.
 */
export async function callCallable<TRequest = unknown, TResponse = unknown>(
  functions: Functions,
  functionName: string,
  data?: TRequest,
  callbacks?: CallCallableCallbacks,
  transport?: CallCallableTransport,
): Promise<TResponse> {
  const timeoutMs = transport?.timeoutMs;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new TypeError(
      `callCallable: timeoutMs must be a finite positive number of milliseconds (got ${String(timeoutMs)})`,
    );
  }
  const limitedUseRequested = transport?.limitedUseAppCheck === true;
  // Built only from the options actually supplied, and left `undefined` when
  // none are — an absent key must stay absent on the SDK call, so nothing
  // changes for a caller that opts into neither.
  const buildSdkOptions = (limitedUse: boolean): HttpsCallableOptions | undefined =>
    timeoutMs === undefined && !limitedUse
      ? undefined
      : {
          ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
          ...(limitedUse ? { limitedUseAppCheckTokens: true } : {}),
        };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The outer deadline starts BEFORE the SDK is invoked so it bounds the
    // whole invocation, including the SDK's pre-transport auth/App Check
    // token acquisition (the SDK's own timer starts only after that phase).
    // ONE timer for the whole call: a throttle fallback retry races the SAME
    // deadline promise, so both attempts together stay inside timeoutMs.
    const deadline =
      timeoutMs === undefined
        ? undefined
        : new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(deadlineExceededError(functionName, timeoutMs)), timeoutMs);
          });
    const payload = stripUndefinedDeep(data) as TRequest;
    const attempt = (limitedUse: boolean): Promise<HttpsCallableResult<TResponse>> => {
      const fn: HttpsCallable<TRequest, TResponse> = httpsCallable(
        functions,
        functionName,
        buildSdkOptions(limitedUse),
      );
      const invocation = fn(payload);
      if (deadline !== undefined) {
        // If the deadline wins the race, the SDK invocation is still pending and
        // may reject later (e.g. its own transport timer). Give it a consumer so
        // a post-deadline settlement can never surface as an unhandled rejection.
        void invocation.catch(() => {});
      }
      return deadline === undefined
        ? invocation
        : (Promise.race([invocation, deadline]) as Promise<HttpsCallableResult<TResponse>>);
    };
    let result: HttpsCallableResult<TResponse>;
    try {
      result = await attempt(limitedUseRequested);
    } catch (error) {
      // The limited-use token path has NO soft failure: the SDK asks the App
      // Check provider for a fresh token with no catch, so one failed exchange
      // opens the provider's backoff window and every later limited-use call
      // rejects from it. Fall back ONCE to the standard cached-token path,
      // which returns a valid cached token without touching the provider.
      //
      // Safe against double submission: both throttle codes are thrown in the
      // SDK's pre-transport token phase, so the first attempt never reached the
      // wire and the backend saw nothing. Every other error class — including a
      // deadline expiry, whose outcome is UNKNOWN — falls straight through.
      if (!limitedUseRequested || !isAppCheckThrottleError(error)) throw error;
      // Informational report: bounded safe metadata only, same channel and same
      // no-payload contract as the failure report below.
      callbacks?.captureException?.(error, {
        functionName,
        timeoutMs,
        limitedUseAppCheckFallback: true,
      });
      result = await attempt(false);
    }
    return result.data as TResponse;
  } catch (error) {
    // Telemetry gets bounded metadata only — never the request payload.
    callbacks?.captureException?.(error, { functionName, timeoutMs });
    // Caller-local handling keeps the payload (existing contract).
    callbacks?.onError?.(error, { functionName, requestData: data });
    throw error;
  } finally {
    // Clear on every settled path — success, SDK failure, or deadline.
    if (timer !== undefined) clearTimeout(timer);
  }
}
