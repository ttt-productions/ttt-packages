'use client';

import { useCallback, useRef, useState } from 'react';

export interface UseAsyncActionOptions {
  onError: (error: unknown) => void;
}

export interface AsyncAction<TArgs extends unknown[]> {
  run: (...args: TArgs) => Promise<boolean>;
  pending: boolean;
}

/** The guard is a ref, not state, so two clicks inside one frame cannot both start the action. */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<unknown>,
  options: UseAsyncActionOptions,
): AsyncAction<TArgs> {
  const [pending, setPending] = useState(false);
  const inFlightRef = useRef(false);
  const actionRef = useRef(action);
  const onErrorRef = useRef(options.onError);
  actionRef.current = action;
  onErrorRef.current = options.onError;

  const run = useCallback(async (...args: TArgs): Promise<boolean> => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    setPending(true);
    try {
      await actionRef.current(...args);
      return true;
    } catch (error) {
      onErrorRef.current(error);
      return false;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending };
}
