'use client';

import { useEffect, useRef } from 'react';
import {
  getLastBootLookupFailureClass,
  type BootLookupFailureClass,
} from '../client/auth-boot-lookup-guard.js';
import {
  peekPersistedAuthUser,
  type PersistedAuthUserPeek,
} from '../client/persisted-auth-peek.js';

export type AuthBootPurge = {
  persistedUid: string | undefined;
  failureClass: BootLookupFailureClass | null;
};

export type AuthBootPurgeSentinelProps = {
  loading: boolean;
  signedIn: boolean;
  onPurged: (purge: AuthBootPurge) => void;
  peek?: () => Promise<PersistedAuthUserPeek>;
};

export function AuthBootPurgeSentinel({
  loading,
  signedIn,
  onPurged,
  peek = peekPersistedAuthUser,
}: AuthBootPurgeSentinelProps) {
  const peekPromiseRef = useRef<Promise<PersistedAuthUserPeek> | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    peekPromiseRef.current ??= peek();
  }, [peek]);

  useEffect(() => {
    // Only the first resolution can be a boot purge: no user action signs out before it.
    if (loading || settledRef.current) return;
    settledRef.current = true;
    if (signedIn) return;
    void peekPromiseRef.current?.then((persisted) => {
      if (!persisted.existed) return;
      onPurged({
        persistedUid: persisted.uid,
        failureClass: getLastBootLookupFailureClass(),
      });
    });
  }, [loading, signedIn, onPurged]);

  return null;
}
