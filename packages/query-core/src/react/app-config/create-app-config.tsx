'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestoreDb } from '../firestore/context.js';

export type AppConfigStatus = 'loading' | 'ready' | 'missing' | 'unavailable';

export type StoredAppConfig = Readonly<Record<string, unknown>>;

export type AppConfigLeverOf<TLevers extends object> = keyof TLevers & string;

export type AppConfigSnapshotState<TLevers extends object, TExtra extends object> = {
  status: AppConfigStatus;
  levers: TLevers;
  refusedLevers: readonly AppConfigLeverOf<TLevers>[];
} & TExtra;

export type AppConfigState<TLevers extends object, TExtra extends object> = AppConfigSnapshotState<
  TLevers,
  TExtra
> & {
  retry: () => void;
  retrying: boolean;
};

export interface AppConfigDefinition<TLevers extends object, TExtra extends object> {
  path: string;
  defaults: TLevers;
  readLevers: (stored: StoredAppConfig) => TLevers;
  isLeverRefused: (stored: StoredAppConfig, lever: AppConfigLeverOf<TLevers>) => boolean;
  extra: {
    read: (stored: StoredAppConfig | null) => TExtra;
    whileUnknown: TExtra;
  };
  onLeverRefused?: (lever: AppConfigLeverOf<TLevers>, value: unknown) => void;
  onUnavailable?: (error: unknown, attempts: number) => void;
}

export interface AppConfig<TLevers extends object, TExtra extends object> {
  AppConfigProvider: (props: { children: ReactNode }) => ReactNode;
  useAppConfig: () => AppConfigState<TLevers, TExtra>;
  readAppConfigSnapshot: (
    stored: StoredAppConfig | null,
  ) => AppConfigSnapshotState<TLevers, TExtra>;
  LOADING_APP_CONFIG: AppConfigSnapshotState<TLevers, TExtra>;
  UNAVAILABLE_APP_CONFIG: AppConfigSnapshotState<TLevers, TExtra>;
}

// A permission-denied error ends a Firestore listener for good, and the first listen can lose a race
// with the first App Check token, so the listener re-subscribes on its own: a short backoff, then
// about once a minute for as long as the page is open.
export const APP_CONFIG_MAX_QUICK_ATTEMPTS = 6;
export const APP_CONFIG_BACKGROUND_RETRY_MS = 60_000;

function quickRetryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 10_000);
}

export function createAppConfig<TLevers extends object, TExtra extends object>(
  definition: AppConfigDefinition<TLevers, TExtra>,
): AppConfig<TLevers, TExtra> {
  const leverKeys = Object.keys(definition.defaults) as AppConfigLeverOf<TLevers>[];

  const LOADING_APP_CONFIG: AppConfigSnapshotState<TLevers, TExtra> = {
    ...definition.extra.whileUnknown,
    status: 'loading',
    levers: definition.defaults,
    refusedLevers: [],
  };
  const UNAVAILABLE_APP_CONFIG: AppConfigSnapshotState<TLevers, TExtra> = {
    ...LOADING_APP_CONFIG,
    status: 'unavailable',
  };

  function readAppConfigSnapshot(
    stored: StoredAppConfig | null,
  ): AppConfigSnapshotState<TLevers, TExtra> {
    const extra = definition.extra.read(stored);
    if (stored === null) {
      return { ...extra, status: 'missing', levers: definition.defaults, refusedLevers: [] };
    }
    return {
      ...extra,
      status: 'ready',
      levers: definition.readLevers(stored),
      refusedLevers: leverKeys.filter((lever) => definition.isLeverRefused(stored, lever)),
    };
  }

  const AppConfigContext = createContext<AppConfigState<TLevers, TExtra>>({
    ...LOADING_APP_CONFIG,
    retry: () => {},
    retrying: false,
  });

  function AppConfigProvider({ children }: { children: ReactNode }) {
    const db = useFirestoreDb();
    const [snapshot, setSnapshot] =
      useState<AppConfigSnapshotState<TLevers, TExtra>>(LOADING_APP_CONFIG);
    const [subscription, setSubscription] = useState(0);
    const [retrying, setRetrying] = useState(false);
    const reportedRefusals = useRef(new Set<string>());

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
            const stored: StoredAppConfig | null = snap.exists() ? snap.data() : null;
            const next = readAppConfigSnapshot(stored);
            for (const lever of next.refusedLevers) {
              const value: unknown = stored?.[lever];
              const key = `${lever}:${typeof value}:${JSON.stringify(value)}`;
              if (reportedRefusals.current.has(key)) continue;
              reportedRefusals.current.add(key);
              definition.onLeverRefused?.(lever, value);
            }
            setSnapshot(next);
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
              setSnapshot((current) =>
                current.status === 'loading' ? UNAVAILABLE_APP_CONFIG : current,
              );
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

    const value = useMemo<AppConfigState<TLevers, TExtra>>(
      () => ({ ...snapshot, retry, retrying }),
      [snapshot, retry, retrying],
    );

    return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
  }

  function useAppConfig(): AppConfigState<TLevers, TExtra> {
    return useContext(AppConfigContext);
  }

  return {
    AppConfigProvider,
    useAppConfig,
    readAppConfigSnapshot,
    LOADING_APP_CONFIG,
    UNAVAILABLE_APP_CONFIG,
  };
}
