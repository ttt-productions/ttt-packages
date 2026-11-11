import type { ServerFirestore } from '@ttt-productions/firebase-helpers/server';
import { SweepStateSchema } from '../sweep-state.js';
import type {
  SweepAuthScanLap,
  SweepDeferredRow,
  SweepRollingCursor,
  SweepState,
} from '../sweep-state.js';

export interface SweepStateStoreConfig<Name extends string> {
  readonly firestore: () => ServerFirestore;
  readonly path: (name: Name) => string;
}

export interface SweepStatePatch {
  readonly rollingCursor?: SweepRollingCursor;
  readonly deferred?: readonly SweepDeferredRow[];
  readonly fullScanLap?: SweepAuthScanLap | null;
  readonly fullScanLastRunAt?: number;
}

export interface SweepStateStore<Name extends string> {
  read(name: Name): Promise<SweepState | undefined>;
  update(name: Name, patch: SweepStatePatch, now: number): Promise<SweepState>;
}

function applyPatch(stored: SweepState | undefined, patch: SweepStatePatch, now: number) {
  const next: Record<string, unknown> = { ...(stored ?? {}), updatedAt: now };
  if (patch.rollingCursor !== undefined) next.rollingCursor = patch.rollingCursor;
  if (patch.fullScanLastRunAt !== undefined) next.fullScanLastRunAt = patch.fullScanLastRunAt;
  if (patch.fullScanLap === null) delete next.fullScanLap;
  else if (patch.fullScanLap !== undefined) next.fullScanLap = patch.fullScanLap;
  if (patch.deferred !== undefined) {
    if (patch.deferred.length === 0) delete next.deferred;
    else next.deferred = [...patch.deferred];
  }
  return SweepStateSchema.parse(next);
}

export function createSweepStateStore<Name extends string>(
  config: SweepStateStoreConfig<Name>,
): SweepStateStore<Name> {
  const ref = (name: Name) => config.firestore().doc(config.path(name));
  return {
    async read(name) {
      const snapshot = await ref(name).get();
      return snapshot.exists ? SweepStateSchema.parse(snapshot.data()) : undefined;
    },
    update(name, patch, now) {
      const target = ref(name);
      return config.firestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(target);
        const stored = snapshot.exists ? SweepStateSchema.parse(snapshot.data()) : undefined;
        const next = applyPatch(stored, patch, now);
        transaction.set(target, next);
        return next;
      });
    },
  };
}
