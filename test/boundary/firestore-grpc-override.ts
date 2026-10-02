// The verdict behind firestore-grpc-override-guard.test.ts, kept free of the test runner so the
// same rule can be evaluated against any pair of manifests.

import { readFileSync } from 'node:fs';
import semver from 'semver';

// The first release outside GHSA-m9gg-hp2v-232j. The 1.14 line stayed affected until 1.14.5.
export const PATCHED_GRPC_MIN = '1.13.6';
const AFFECTED_GRPC = `<${PATCHED_GRPC_MIN} || >=1.14.0 <1.14.5`;

export const FIRESTORE = '@firebase/firestore';
export const GRPC = '@grpc/grpc-js';

interface RootManifest {
  overrides?: Record<string, unknown>;
}

interface FirestoreManifest {
  dependencies?: Record<string, string>;
}

export interface FirestoreGrpcOverrideState {
  firestoreGrpcRange: string;
  overrideRange: string | undefined;
}

export function readFirestoreGrpcOverrideState(
  rootManifestPath: string,
  firestoreManifestPath: string,
): FirestoreGrpcOverrideState {
  const root = JSON.parse(readFileSync(rootManifestPath, 'utf8')) as RootManifest;
  const firestore = JSON.parse(readFileSync(firestoreManifestPath, 'utf8')) as FirestoreManifest;
  const firestoreGrpcRange = firestore.dependencies?.[GRPC];
  if (firestoreGrpcRange === undefined) {
    throw new Error(`${FIRESTORE} no longer declares ${GRPC}. Remove the ${FIRESTORE} override from package.json and run npm install.`);
  }
  const scoped = root.overrides?.[FIRESTORE];
  const overrideRange =
    scoped !== null && typeof scoped === 'object' && typeof (scoped as Record<string, unknown>)[GRPC] === 'string'
      ? ((scoped as Record<string, unknown>)[GRPC] as string)
      : undefined;
  return { firestoreGrpcRange, overrideRange };
}

/** `null` in the one passing state; otherwise the reason the override is wrong. */
export function firestoreGrpcOverrideProblem({ firestoreGrpcRange, overrideRange }: FirestoreGrpcOverrideState): string | null {
  const firestoreMin = semver.minVersion(firestoreGrpcRange);
  if (firestoreMin !== null && semver.gte(firestoreMin, PATCHED_GRPC_MIN)) {
    return `Firestore now declares a patched ${GRPC} range (${firestoreGrpcRange}). Remove the ${FIRESTORE} override from package.json and run npm install.`;
  }
  if (overrideRange === undefined) {
    return `Firestore still declares an unpatched ${GRPC} range (${firestoreGrpcRange}) and package.json has no ${FIRESTORE} override for ${GRPC}. Restore it with a patched range.`;
  }
  if (semver.validRange(overrideRange) === null || semver.intersects(overrideRange, AFFECTED_GRPC)) {
    return `The ${FIRESTORE} override pins ${GRPC} to ${overrideRange}, which admits an affected version. Pin a range at or above ${PATCHED_GRPC_MIN} that excludes 1.14.0 through 1.14.4.`;
  }
  return null;
}
