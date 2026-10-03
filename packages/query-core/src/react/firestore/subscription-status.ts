'use client';

import { useCallback, useState } from 'react';
import type { FirestoreSourceState } from '../../firestore/types.js';

interface SubscriptionStatus {
  identity: string;
  error: Error | null;
  sourceState: FirestoreSourceState;
}

type StatusPatch = Partial<Omit<SubscriptionStatus, 'identity'>>;

/**
 * A realtime listener's source state and error, tagged to the subscription identity that
 * produced them. A new identity reads `connecting` with no error from its first render;
 * writes made for a retired identity are dropped once the new identity's listener has
 * started (it calls `reset`).
 */
export function useSubscriptionStatus(identity: string) {
  const [status, setStatus] = useState<SubscriptionStatus>(() => ({
    identity,
    error: null,
    sourceState: 'connecting',
  }));

  const current: SubscriptionStatus =
    status.identity === identity ? status : { identity, error: null, sourceState: 'connecting' };

  const reset = useCallback(() => {
    setStatus({ identity, error: null, sourceState: 'connecting' });
  }, [identity]);

  const update = useCallback(
    (patch: StatusPatch | ((prev: SubscriptionStatus) => StatusPatch)) => {
      setStatus((prev) => {
        if (prev.identity !== identity) return prev;
        const next = typeof patch === 'function' ? patch(prev) : patch;
        return { ...prev, ...next };
      });
    },
    [identity],
  );

  return { error: current.error, sourceState: current.sourceState, reset, update };
}
