'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestoreDb } from '../firestore/context.js';

export type StoredAppConfig = Readonly<Record<string, unknown>>;

export type AppConfigLeverOf<TLevers extends object> = keyof TLevers & string;

export type AppConfigSnapshotState<TLevers extends object> =
  | { status: 'loading' }
  | { status: 'ready'; levers: TLevers }
  | { status: 'unavailable' }
  | { status: 'invalid' };

export type AppConfigStatus = AppConfigSnapshotState<object>['status'];

export type AppConfigState<TLevers extends object> = AppConfigSnapshotState<TLevers> & {
  retry: () => void;
  retrying: boolean;
};

export interface AppConfigDefinition<TLevers extends object> {
  path: string;
  read: (stored: StoredAppConfig | null) => TLevers;
  onUnavailable?: (error: unknown, attempts: number) => void;
  onInvalid?: (error: unknown) => void;
}

export interface AppConfig<TLevers extends object> {
  AppConfigProvider: (props: { children: ReactNode }) => ReactNode;
  useAppConfig: () => AppConfigState<TLevers>;
  readAppConfigSnapshot: (stored: StoredAppConfig | null) => AppConfigSnapshotState<TLevers>;
}

// A permission-denied error ends a Firestore listener for good, and the first listen can lose a race
// with the first App Check token, so the listener re-subscribes on its own: a short backoff, then
// about once a minute for as long as the page is open.
export const APP_CONFIG_MAX_QUICK_ATTEMPTS = 6;
export const APP_CONFIG_BACKGROUND_RETRY_MS = 60_000;

function quickRetryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 10_000);
}

const LOADING = { status: 'loading' } as const;
const UNAVAILABLE = { status: 'unavailable' } as const;
const INVALID = { status: 'invalid' } as const;

export function createAppConfig<TLevers extends object>(
  definition: AppConfigDefinition<TLevers>,
): AppConfig<TLevers> {
  function readStored(stored: StoredAppConfig | null): {
    state: AppConfigSnapshotState<TLevers>;
    invalidity?: { error: unknown };
  } {
    try {
      return { state: { status: 'ready', levers: definition.read(stored) } };
    } catch (error) {
      return { state: INVALID, invalidity: { error } };
    }
  }

  function readAppConfigSnapshot(stored: StoredAppConfig | null): AppConfigSnapshotState<TLevers> {
    return readStored(stored).state;
  }

  const AppConfigContext = createContext<AppConfigState<TLevers>>({
    ...LOADING,
    retry: () => {},
    retrying: false,
  });

  function AppConfigProvider({ children }: { children: ReactNode }) {
    const db = useFirestoreDb();
    const [snapshot, setSnapshot] = useState<AppConfigSnapshotState<TLevers>>(LOADING);
    const [subscription, setSubscription] = useState(0);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
      const ref = doc(db, definition.path);
      let attempt = 0;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe: (() => void) | undefined;
      let disposed = false;

      const subscribe = () => {
        if (disposed) return;
        unsubscribe = onSnapshot(
          ref,
          (snap) => {
            attempt = 0;
            const { state, invalidity } = readStored(snap.exists() ? snap.data() : null);
            if (invalidity) definition.onInvalid?.(invalidity.error);
            setSnapshot(state);
            setRetrying(false);
          },
          (error) => {
            unsubscribe?.();
            unsubscribe = undefined;
            attempt += 1;
            if (attempt < APP_CONFIG_MAX_QUICK_ATTEMPTS) {
              retryTimer = setTimeout(subscribe, quickRetryDelayMs(attempt));
              return;
            }
            if (attempt === APP_CONFIG_MAX_QUICK_ATTEMPTS) {
              definition.onUnavailable?.(error, attempt);
              // A snapshot already read stays the best knowledge there is.
              setSnapshot((current) => (current.status === 'loading' ? UNAVAILABLE : current));
              setRetrying(false);
            }
            retryTimer = setTimeout(subscribe, APP_CONFIG_BACKGROUND_RETRY_MS);
          },
        );
      };

      subscribe();
      return () => {
        disposed = true;
        if (retryTimer !== undefined) clearTimeout(retryTimer);
        unsubscribe?.();
      };
    }, [db, subscription]);

    const retry = useCallback(() => {
      setRetrying(true);
      setSubscription((count) => count + 1);
    }, []);

    const value = useMemo<AppConfigState<TLevers>>(
      () => ({ ...snapshot, retry, retrying }),
      [snapshot, retry, retrying],
    );

    return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
  }

  function useAppConfig(): AppConfigState<TLevers> {
    return useContext(AppConfigContext);
  }

  return { AppConfigProvider, useAppConfig, readAppConfigSnapshot };
}
