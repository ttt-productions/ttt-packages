"use client";

import { useState, useCallback, useRef } from "react";
import { type Functions } from "firebase/functions";
import {
  callCallable,
  type CallCallableCallbacks,
  type CallCallableTransport,
} from "../client/call-callable.js";

/** Alias of the shared callback contract — kept for existing consumers' imports. */
export type CallableMutationCallbacks = CallCallableCallbacks;

export interface UseCallableMutationOptions extends CallableMutationCallbacks, CallCallableTransport {
  /**
   * Returns the Functions instance. Lazy so SSR-safe.
   * Required.
   */
  getFunctions: () => Functions | null | undefined;
}

export interface UseCallableMutationResult {
  callFunction: <TRequest = unknown, TResponse = unknown>(
    functionName: string,
    data?: TRequest,
  ) => Promise<TResponse>;
  /**
   * True while ANY call from this hook instance is in flight — overlapping calls keep it
   * true until the last one settles. It is instance-wide, not per action: a control
   * that needs its own in-progress state takes it from its own action.
   */
  isLoading: boolean;
}

/**
 * Generic React hook for invoking a Firebase Callable Function.
 * Error reporting is injected via callbacks — the hook does not own toast
 * or any app-specific UX. Consumers wire their own toast in `onError`.
 */
export function useCallableMutation(
  options: UseCallableMutationOptions,
): UseCallableMutationResult {
  const { getFunctions, onError, captureException, timeoutMs, limitedUseAppCheck } = options;
  const [inFlight, setInFlight] = useState(0);
  const onErrorRef = useRef(onError);
  const captureRef = useRef(captureException);
  onErrorRef.current = onError;
  captureRef.current = captureException;

  const callFunction = useCallback(
    async <TRequest = unknown, TResponse = unknown>(
      functionName: string,
      data?: TRequest,
    ): Promise<TResponse> => {
      const functions = getFunctions();
      if (!functions) {
        const err = new Error(
          "Firebase Functions is not available in this environment.",
        );
        captureRef.current?.(err, { functionName });
        throw err;
      }
      setInFlight((n) => n + 1);
      try {
        // Delegate to the ONE shared invocation primitive (owns the
        // undefined-strip + error-callback contract + total-invocation
        // deadline + the limited-use App Check opt-in — see
        // client/call-callable.ts).
        return await callCallable<TRequest, TResponse>(
          functions,
          functionName,
          data,
          {
            onError: (error, ctx) => onErrorRef.current?.(error, ctx),
            captureException: (error, ctx) => captureRef.current?.(error, ctx),
          },
          { timeoutMs, limitedUseAppCheck },
        );
      } finally {
        setInFlight((n) => n - 1);
      }
    },
    [getFunctions, timeoutMs, limitedUseAppCheck],
  );

  return { callFunction, isLoading: inFlight > 0 };
}

/**
 * Convenience factory: pre-binds a `getFunctions` provider for callers
 * that don't want to thread it through every hook call. Overrides accept the
 * full option surface minus the bound provider (callbacks + transport).
 */
export function createCallableClient(getFunctions: () => Functions | null | undefined) {
  return {
    useCallableMutation: (overrides?: Omit<UseCallableMutationOptions, "getFunctions">) =>
      useCallableMutation({ getFunctions, ...overrides }),
  };
}
