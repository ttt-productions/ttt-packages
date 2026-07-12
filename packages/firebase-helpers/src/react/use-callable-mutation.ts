"use client";

import { useState, useCallback, useRef } from "react";
import { type Functions } from "firebase/functions";
import { callCallable, type CallCallableCallbacks } from "../client/call-callable.js";

/** Alias of the shared callback contract — kept for existing consumers' imports. */
export type CallableMutationCallbacks = CallCallableCallbacks;

export interface UseCallableMutationOptions extends CallableMutationCallbacks {
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
  const { getFunctions, onError, captureException } = options;
  const [isLoading, setIsLoading] = useState(false);
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
      setIsLoading(true);
      try {
        // Delegate to the ONE shared invocation primitive (owns the
        // undefined-strip + error-callback contract — see client/call-callable.ts).
        return await callCallable<TRequest, TResponse>(functions, functionName, data, {
          onError: (error, ctx) => onErrorRef.current?.(error, ctx),
          captureException: (error, ctx) => captureRef.current?.(error, ctx),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [getFunctions],
  );

  return { callFunction, isLoading };
}

/**
 * Convenience factory: pre-binds a `getFunctions` provider for callers
 * that don't want to thread it through every hook call.
 */
export function createCallableClient(getFunctions: () => Functions | null | undefined) {
  return {
    useCallableMutation: (overrides?: CallableMutationCallbacks) =>
      useCallableMutation({ getFunctions, ...overrides }),
  };
}
