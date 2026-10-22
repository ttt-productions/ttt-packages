'use client';

import { useState, useCallback, useRef } from 'react';
import {
  callCallable,
  type CallCallableCallbacks,
  type CallCallableTransport,
  type FunctionsProvider,
} from '../client/call-callable.js';

export interface UseCallableMutationOptions extends CallCallableCallbacks, CallCallableTransport {
  getFunctions: FunctionsProvider;
}

export interface UseCallableMutationResult {
  callFunction: <TRequest = unknown, TResponse = unknown>(
    functionName: string,
    data?: TRequest,
  ) => Promise<TResponse>;
  isLoading: boolean;
}

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
      setInFlight((n) => n + 1);
      try {
        return await callCallable<TRequest, TResponse>(
          getFunctions,
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

export function createCallableClient(getFunctions: FunctionsProvider) {
  return {
    useCallableMutation: (overrides?: Omit<UseCallableMutationOptions, 'getFunctions'>) =>
      useCallableMutation({ getFunctions, ...overrides }),
  };
}
