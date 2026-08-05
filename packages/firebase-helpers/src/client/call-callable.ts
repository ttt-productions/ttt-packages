import { httpsCallable, type Functions, type HttpsCallable } from "firebase/functions";

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
   * semantics. Receives BOUNDED SAFE METADATA ONLY ({ functionName, timeoutMs })
   * — never the request payload, so callable arguments cannot leak into
   * telemetry systems.
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
 * total-invocation deadline (see CallCallableTransport); consumers own
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The outer deadline starts BEFORE the SDK is invoked so it bounds the
    // whole invocation, including the SDK's pre-transport auth/App Check
    // token acquisition (the SDK's own timer starts only after that phase).
    const deadline =
      timeoutMs === undefined
        ? undefined
        : new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(deadlineExceededError(functionName, timeoutMs)), timeoutMs);
          });
    const fn: HttpsCallable<TRequest, TResponse> = httpsCallable(
      functions,
      functionName,
      timeoutMs === undefined ? undefined : { timeout: timeoutMs },
    );
    const invocation = fn(stripUndefinedDeep(data) as TRequest);
    if (deadline !== undefined) {
      // If the deadline wins the race, the SDK invocation is still pending and
      // may reject later (e.g. its own transport timer). Give it a consumer so
      // a post-deadline settlement can never surface as an unhandled rejection.
      void invocation.catch(() => {});
    }
    const result =
      deadline === undefined ? await invocation : await Promise.race([invocation, deadline]);
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
