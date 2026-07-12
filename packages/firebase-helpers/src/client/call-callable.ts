import { httpsCallable, type Functions, type HttpsCallable } from "firebase/functions";

export interface CallCallableCallbacks {
  /** Called when a call throws. callCallable still re-throws after this fires. */
  onError?: (error: unknown, ctx: { functionName: string; requestData: unknown }) => void;
  /** Optional structured error reporter (Sentry, etc.). Generic — no toast semantics. */
  captureException?: (error: unknown, ctx: Record<string, unknown>) => void;
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

/**
 * Invoke a Firebase Callable Function — the ONE shared invocation primitive.
 * `useCallableMutation` (./react) delegates here; non-hook contexts (pre-auth
 * flows, plain modules) call it directly. Owns the undefined-strip (see
 * stripUndefinedDeep) and the generic error-callback contract; consumers own
 * toast/UX semantics.
 */
export async function callCallable<TRequest = unknown, TResponse = unknown>(
  functions: Functions,
  functionName: string,
  data?: TRequest,
  callbacks?: CallCallableCallbacks,
): Promise<TResponse> {
  try {
    const fn: HttpsCallable<TRequest, TResponse> = httpsCallable(
      functions,
      functionName,
    );
    const result = await fn(stripUndefinedDeep(data) as TRequest);
    return result.data as TResponse;
  } catch (error) {
    callbacks?.captureException?.(error, { functionName, requestData: data });
    callbacks?.onError?.(error, { functionName, requestData: data });
    throw error;
  }
}
