'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Firestore } from 'firebase/firestore';

/** The realtime read whose listener failed, as a provider-level listener-error handler receives it. */
export interface FirestoreListenerErrorDetails {
  /** The hook whose listener failed. */
  hook: 'useFirestoreDoc' | 'useFirestoreCollection' | 'useFirestoreLiveInfinite' | 'useBatchFirestoreDocs';
  /** The read's React Query key, as the caller passed it. */
  queryKey: readonly unknown[];
  /** The document or collection path the listener read. */
  path: string;
}

/**
 * Receives each error a realtime listener surfaces — once per surfaced error, after a
 * `permission-denied` has spent its resubscribe ladder (any other code at once). The read keeps
 * the error in its own result; this is the app's one place to capture it.
 */
export type FirestoreListenerErrorHandler = (error: Error, details: FirestoreListenerErrorDetails) => void;

interface FirestoreContextValue {
  db: Firestore;
  onListenerError?: FirestoreListenerErrorHandler;
}

const FirestoreContext = createContext<FirestoreContextValue | null>(null);

export interface FirestoreProviderProps {
  db: Firestore;
  /**
   * The app's capture for a realtime listener's surfaced error. A subscribed read never lands its
   * listener error in the query cache, so a reporter that watches the cache does not see it; this
   * hands it over instead. Without it the hooks write the error to `console.error`.
   */
  onListenerError?: FirestoreListenerErrorHandler;
  children: ReactNode;
}

/**
 * Provides Firestore instance to all useFirestore* hooks.
 * Wrap your app with this provider alongside QueryProvider.
 *
 * @example
 * ```tsx
 * import { db } from '@/lib/firebase';
 *
 * <QueryProvider>
 *   <FirestoreProvider db={db}>
 *     {children}
 *   </FirestoreProvider>
 * </QueryProvider>
 * ```
 */
export function FirestoreProvider({ db, onListenerError, children }: FirestoreProviderProps) {
  const value = useMemo(() => ({ db, onListenerError }), [db, onListenerError]);
  return (
    <FirestoreContext.Provider value={value}>
      {children}
    </FirestoreContext.Provider>
  );
}

function useFirestoreContext(): FirestoreContextValue {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error(
      'useFirestoreDb must be used within a FirestoreProvider. ' +
      'Wrap your app with <FirestoreProvider db={db}>.'
    );
  }
  return context;
}

/**
 * Access the Firestore instance from context.
 * Throws if used outside of FirestoreProvider.
 */
export function useFirestoreDb(): Firestore {
  return useFirestoreContext().db;
}

/**
 * The function a realtime hook calls with its listener's surfaced error: the provider's
 * `onListenerError` as it stands when the error arrives, or `console.error` when the app supplied
 * none. The returned function keeps one identity, so a listener effect that depends on it is never
 * re-opened by a provider handler written inline.
 */
export function useListenerErrorReporter(): (error: Error, details: FirestoreListenerErrorDetails) => void {
  // Read without requiring the provider: `useBatchFirestoreDocs` takes its `db` as an option and
  // may run outside one, where the error goes to the console.
  const onListenerError = useContext(FirestoreContext)?.onListenerError;
  const handler = useRef(onListenerError);
  useEffect(() => {
    handler.current = onListenerError;
  }, [onListenerError]);
  return useCallback((error: Error, details: FirestoreListenerErrorDetails) => {
    if (handler.current) handler.current(error, details);
    else console.error(`[${details.hook}] Subscription error:`, error);
  }, []);
}
