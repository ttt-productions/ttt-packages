'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ConsentState } from '../consent-state.js';
import type { ConsentStore } from './consent-store.js';

export interface ConsentContextValue {
  consent: ConsentState;
  analyticsEnabled: boolean;
  ready: boolean;
  accept: () => void;
  decline: () => void;
  reopen: () => void;
}

const OUTSIDE_PROVIDER: ConsentContextValue = {
  consent: 'unset',
  analyticsEnabled: false,
  ready: false,
  accept: () => {},
  decline: () => {},
  reopen: () => {},
};

const ConsentContext = createContext<ConsentContextValue>(OUTSIDE_PROVIDER);

export interface ConsentProviderProps {
  store: ConsentStore;
  onAnalyticsChange: (enabled: boolean) => void;
  children: ReactNode;
}

const serverConsent = (): ConsentState => 'unset';
const noSubscription = () => () => {};

export function ConsentProvider({ store, onAnalyticsChange, children }: ConsentProviderProps) {
  const analyticsChange = useRef(onAnalyticsChange);
  analyticsChange.current = onAnalyticsChange;
  const applied = useRef<ConsentState | null>(null);

  const applyAnalytics = useCallback(() => {
    const state = store.get();
    if (applied.current === state) return;
    applied.current = state;
    analyticsChange.current(state === 'granted');
  }, [store]);

  // The switch runs before the listener, so analytics is on or off before any consumer re-renders,
  // in the tab that chose and in every other tab.
  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(() => {
        applyAnalytics();
        listener();
      }),
    [store, applyAnalytics],
  );

  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const consent = useSyncExternalStore(subscribe, store.get, serverConsent);

  useEffect(() => {
    applyAnalytics();
  }, [applyAnalytics]);

  const accept = useCallback(() => store.set('granted'), [store]);
  const decline = useCallback(() => store.set('denied'), [store]);
  const reopen = useCallback(() => store.set('unset'), [store]);

  const value = useMemo<ConsentContextValue>(
    () => ({ consent, analyticsEnabled: consent === 'granted', ready, accept, decline, reopen }),
    [consent, ready, accept, decline, reopen],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  return useContext(ConsentContext);
}
