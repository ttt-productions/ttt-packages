'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { logEvent, setUserId, setUserProperties, type Analytics } from 'firebase/analytics';
import type { FirebaseAnalyticsHandle } from '../client/firebase-init.js';

export type AnalyticsEventParams = Record<string, unknown>;
export type AnalyticsUserProperties = Record<string, string>;

const noAnalyticsOnServer = (): Analytics | undefined => undefined;

export function useFirebaseAnalyticsHandle(handle: FirebaseAnalyticsHandle): Analytics | undefined {
  return useSyncExternalStore(handle.subscribe, handle.get, noAnalyticsOnServer);
}

export function useFirebaseAnalyticsEvents<TEventName extends string = string>(
  handle: FirebaseAnalyticsHandle,
  enabled: boolean,
): (eventName: TEventName, params?: AnalyticsEventParams) => void {
  return useCallback(
    (eventName, params) => {
      const analytics = handle.get();
      if (!enabled || !analytics) return;
      // The SDK types each of its own standard event names on a separate overload, so a caller's
      // name is passed through its general one.
      const name: string = eventName;
      logEvent(analytics, name, params);
    },
    [handle, enabled],
  );
}

export interface FirebaseAnalyticsPageViewsProps {
  handle: FirebaseAnalyticsHandle;
  enabled: boolean;
  pathname: string | null;
}

export function FirebaseAnalyticsPageViews({
  handle,
  enabled,
  pathname,
}: FirebaseAnalyticsPageViewsProps) {
  const analytics = useFirebaseAnalyticsHandle(handle);
  const loggedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !enabled || !analytics) return;
    if (loggedPath.current === pathname) return;
    loggedPath.current = pathname;
    logEvent(analytics, 'page_view', {
      page_path: pathname,
      page_title: typeof document !== 'undefined' ? document.title : '',
    });
  }, [pathname, enabled, analytics]);

  return null;
}

export interface FirebaseAnalyticsIdentityProps {
  handle: FirebaseAnalyticsHandle;
  enabled: boolean;
  uid: string | null;
  userProperties?: AnalyticsUserProperties;
}

function clearedProperties(keys: readonly string[]): Record<string, null> {
  return Object.fromEntries(keys.map((key) => [key, null]));
}

export function FirebaseAnalyticsIdentity({
  handle,
  enabled,
  uid,
  userProperties,
}: FirebaseAnalyticsIdentityProps) {
  const analytics = useFirebaseAnalyticsHandle(handle);
  const lastUid = useRef<string | null>(null);
  const setKeys = useRef<string[]>([]);
  const propertiesKey = JSON.stringify(userProperties ?? {});

  useEffect(() => {
    const previousUid = lastUid.current;
    lastUid.current = uid;
    if (!analytics) return;
    const properties = JSON.parse(propertiesKey) as AnalyticsUserProperties;
    const sessionChanged = previousUid !== null && previousUid !== uid;
    if (sessionChanged || !enabled) {
      setUserId(analytics, null);
      if (setKeys.current.length > 0) {
        setUserProperties(analytics, clearedProperties(setKeys.current));
        setKeys.current = [];
      }
    }
    if (enabled && uid) {
      setUserId(analytics, uid);
      const keys = Object.keys(properties);
      if (keys.length > 0) {
        setUserProperties(analytics, properties);
        setKeys.current = keys;
      }
    }
  }, [uid, propertiesKey, enabled, analytics]);

  return null;
}
