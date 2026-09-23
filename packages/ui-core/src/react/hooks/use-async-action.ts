"use client";

import { useCallback, useRef, useState } from "react";

export interface UseAsyncActionOptions {
  /**
   * Receives anything the action throws. REQUIRED, so every call site decides what a
   * failure means (surface it, capture it, or accept that another layer already did):
   * `run` itself never rejects, so a fire-and-forget `onClick={() => void run()}` can
   * never become an unhandled rejection.
   */
  onError: (error: unknown) => void;
}

export interface AsyncAction<TArgs extends unknown[]> {
  /**
   * Starts the action unless one is already in flight — a repeat call while pending is
   * ignored. Resolves once the action settles: `true` when it completed, `false` when it
   * was ignored or threw. Never rejects.
   */
  run: (...args: TArgs) => Promise<boolean>;
  /** True from the moment `run` starts the action until it settles. */
  pending: boolean;
}

/**
 * Pending state + repeat guard for async work that is NOT a React Query mutation
 * (a local media step, a sign-out, an awaited navigation). Feed `pending` to the
 * control's own `pending` prop. Server writes stay mutations — this hook does not
 * replace the data layer's one mutation path.
 *
 * The guard is a ref, not the state, so two clicks inside one frame cannot both start
 * the action.
 */
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
