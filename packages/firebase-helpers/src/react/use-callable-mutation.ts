"use client";

import { useState, useCallback, useRef } from "react";
import { httpsCallable, type Functions, type HttpsCallable } from "firebase/functions";

export interface CallableMutationCallbacks {
  /** Called when a call throws. The hook still re-throws after this fires. */
  onError?: (error: unknown, ctx: { functionName: string; requestData: unknown }) => void;
  /** Optional structured error reporter (Sentry, etc.). Generic — no toast semantics. */
  captureException?: (error: unknown, ctx: Record<string, unknown>) => void;
}

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
        const fn: HttpsCallable<TRequest, TResponse> = httpsCallable(
          functions,
          functionName,
        );
        const result = await fn(data as TRequest);
        return result.data as TResponse;
      } catch (error) {
        captureRef.current?.(error, { functionName, requestData: data });
        onErrorRef.current?.(error, { functionName, requestData: data });
        throw error;
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
