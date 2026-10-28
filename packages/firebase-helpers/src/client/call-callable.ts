import {
  httpsCallable,
  type Functions,
  type HttpsCallable,
  type HttpsCallableOptions,
  type HttpsCallableResult,
} from 'firebase/functions';

import { isAppCheckThrottleError } from '../utils/app-check-throttle.js';
import { CALLABLE_DEADLINE_EXCEEDED_CODE } from '../utils/callable-deadline.js';
import { RECOVERED_FALLBACK_MARKER } from './recovered-fallback.js';

export interface CallCallableCallbacks {
  onError?: (error: unknown, ctx: { functionName: string; requestData: unknown }) => void;
  captureException?: (error: unknown, ctx: Record<string, unknown>) => void;
}

export interface CallCallableTransport {
  timeoutMs?: number;
  limitedUseAppCheck?: boolean;
}

// firebase-js-sdk's callable serializer encodes `undefined` as `null`, which an optional (not
// nullable) zod field rejects. Class instances pass through to the SDK's own encoding.
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    const entries: readonly unknown[] = value;
    return entries.map((entry) => stripUndefinedDeep(entry)) as T;
  }
  if (value !== null && typeof value === 'object' && (value as object).constructor === Object) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefinedDeep(v)]),
    ) as T;
  }
  return value;
}

export type FunctionsProvider = () =>
  Functions | null | undefined | Promise<Functions | null | undefined>;

export const FUNCTIONS_UNAVAILABLE_MESSAGE =
  'Firebase Functions is not available in this environment.';

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function deadlineExceededError(functionName: string, timeoutMs: number): Error {
  const error = new Error(
    `deadline-exceeded: ${functionName} did not settle within ${timeoutMs}ms (outcome unknown — the server may still complete the request)`,
  );
  error.name = 'FirebaseError';
  (error as Error & { code: string }).code = CALLABLE_DEADLINE_EXCEEDED_CODE;
  return error;
}

export async function callCallable<TRequest = unknown, TResponse = unknown>(
  getFunctions: FunctionsProvider,
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
  const buildSdkOptions = (limitedUse: boolean): HttpsCallableOptions | undefined =>
    timeoutMs === undefined && !limitedUse
      ? undefined
      : {
          ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
          ...(limitedUse ? { limitedUseAppCheckTokens: true } : {}),
        };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Started before the SDK is invoked: the SDK's own timer starts only after its token phase.
    const deadline =
      timeoutMs === undefined
        ? undefined
        : new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(deadlineExceededError(functionName, timeoutMs)),
              timeoutMs,
            );
          });
    // A synchronous provider is used as-is, so the SDK is invoked in the same tick as the call.
    const provided = getFunctions();
    let instance: Functions | null | undefined;
    if (isPromiseLike(provided)) {
      const acquiring = Promise.resolve(provided);
      // A provider still pending when the deadline wins must not surface as an unhandled rejection.
      if (deadline !== undefined) void acquiring.catch(() => {});
      instance = await (deadline === undefined ? acquiring : Promise.race([acquiring, deadline]));
    } else {
      instance = provided;
    }
    if (!instance) throw new Error(FUNCTIONS_UNAVAILABLE_MESSAGE);
    const functions = instance;
    const payload = stripUndefinedDeep(data) as TRequest;
    const attempt = (limitedUse: boolean): Promise<HttpsCallableResult<TResponse>> => {
      const fn: HttpsCallable<TRequest, TResponse> = httpsCallable(
        functions,
        functionName,
        buildSdkOptions(limitedUse),
      );
      const invocation = fn(payload);
      if (deadline !== undefined) {
        // An invocation still pending when the deadline wins must not surface as an unhandled rejection.
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
      // Throttle codes are thrown before the request reaches the wire, so one retry cannot
      // double-submit; a backend that refuses a reused token refuses this retry.
      if (!limitedUseRequested || !isAppCheckThrottleError(error)) throw error;
      callbacks?.captureException?.(error, {
        functionName,
        timeoutMs,
        [RECOVERED_FALLBACK_MARKER]: true,
      });
      result = await attempt(false);
    }
    return result.data as TResponse;
  } catch (error) {
    callbacks?.captureException?.(error, { functionName, timeoutMs });
    callbacks?.onError?.(error, { functionName, requestData: data });
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
