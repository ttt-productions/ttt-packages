import { makeInMemoryFirestore } from '@ttt-productions/firebase-helpers/server/testing';
import { createSweepStateStore } from '../src/server/sweep-state-store.js';

export type TestSweep = 'alpha' | 'beta';

export const statePath = (name: TestSweep) => `sweepPositions/${name}`;

export function sweepFixture() {
  const memory = makeInMemoryFirestore();
  const store = createSweepStateStore<TestSweep>({
    firestore: () => memory.db,
    path: statePath,
  });
  return { memory, store, db: memory.db };
}
