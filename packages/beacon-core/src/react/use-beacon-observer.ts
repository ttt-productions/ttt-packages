'use client';

import { useEffect, useRef } from 'react';
import { useFirestoreDoc } from '@ttt-productions/query-core/react';
import type { WithId } from '@ttt-productions/query-core/types';
import { INITIAL_BEACON_OBSERVATION, observeBeacon } from '../beacon-observation.js';
import type { BeaconObservation } from '../beacon-observation.js';

export type ObservedBeaconStamp = Record<string, unknown> & { changeId?: string };

export interface BeaconObserverOptions<TStamp extends ObservedBeaconStamp> {
  docPath: string;
  queryKey: readonly unknown[];
  enabled?: boolean;
  reportFirstLoad: boolean;
  onChange: (stamp: WithId<TStamp> | null) => void;
}

export function useBeaconObserver<TStamp extends ObservedBeaconStamp>({
  docPath,
  queryKey,
  enabled = true,
  reportFirstLoad,
  onChange,
}: BeaconObserverOptions<TStamp>): void {
  const beacon = useFirestoreDoc<TStamp>({ docPath, queryKey, enabled, subscribe: true });
  const observed = useRef<{ docPath: string; observation: BeaconObservation }>({
    docPath,
    observation: INITIAL_BEACON_OBSERVATION,
  });

  const stamp = beacon.data ?? null;
  const live = beacon.sourceState === 'live';

  useEffect(() => {
    const previous =
      observed.current.docPath === docPath
        ? observed.current.observation
        : INITIAL_BEACON_OBSERVATION;
    const decision = observeBeacon(previous, {
      live,
      exists: stamp !== null,
      changeId: stamp?.changeId ?? null,
      reportFirstLoad,
    });
    observed.current = { docPath, observation: decision.next };
    if (decision.report) onChange(stamp);
  }, [stamp, live, docPath, reportFirstLoad, onChange]);
}
