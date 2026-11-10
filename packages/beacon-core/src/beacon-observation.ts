export interface BeaconObservation {
  lastSeen: string | null;
  wasLive: boolean;
}

export const INITIAL_BEACON_OBSERVATION: BeaconObservation = {
  lastSeen: null,
  wasLive: false,
};

export interface BeaconSnapshot {
  live: boolean;
  exists: boolean;
  changeId: string | null;
  reportFirstLoad: boolean;
}

export interface BeaconDecision {
  next: BeaconObservation;
  report: boolean;
}

export function observeBeacon(state: BeaconObservation, snapshot: BeaconSnapshot): BeaconDecision {
  if (!snapshot.live) return { next: state, report: false };

  const { exists, changeId } = snapshot;
  if (!state.wasLive) {
    return { next: { lastSeen: changeId, wasLive: true }, report: snapshot.reportFirstLoad };
  }
  if (!exists) return { next: state, report: false };
  return { next: { lastSeen: changeId, wasLive: true }, report: changeId !== state.lastSeen };
}
