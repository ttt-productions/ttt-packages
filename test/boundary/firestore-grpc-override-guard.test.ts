import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { REPO_ROOT } from './leak-utils';
import { FIRESTORE, firestoreGrpcOverrideProblem, readFirestoreGrpcOverrideState } from './firestore-grpc-override';

// Firestore pins @grpc/grpc-js to a line that GHSA-m9gg-hp2v-232j (high) affects and that never
// received the fix, so the gate's `npm audit --omit=dev --audit-level=high` fails on firebase
// itself. That audit command and its threshold are the publish gate and never change; the root
// package.json instead carries an override scoped to Firestore that lifts @grpc/grpc-js to a
// patched release. This guard keeps the override honest and is the trigger to delete it: it fails
// the moment Firestore declares a patched range, so the override never outlives its reason.

const state = readFirestoreGrpcOverrideState(
  join(REPO_ROOT, 'package.json'),
  join(REPO_ROOT, 'node_modules', FIRESTORE, 'package.json'),
);

describe('boundary: the Firestore @grpc/grpc-js override exists only while Firestore pins an unpatched line', () => {
  it('holds for the installed Firestore and the root package.json', () => {
    expect(firestoreGrpcOverrideProblem(state)).toBeNull();
  });

  it('fails once Firestore declares a patched range, so the override is removed', () => {
    expect(firestoreGrpcOverrideProblem({ firestoreGrpcRange: '~1.14.5', overrideRange: '~1.14.5' })).toBe(
      'Firestore now declares a patched @grpc/grpc-js range (~1.14.5). Remove the @firebase/firestore override from package.json and run npm install.',
    );
    expect(firestoreGrpcOverrideProblem({ firestoreGrpcRange: '^1.13.6', overrideRange: undefined })).toMatch(
      /^Firestore now declares a patched/,
    );
  });

  it('fails when Firestore is still unpatched and the override is missing', () => {
    expect(firestoreGrpcOverrideProblem({ firestoreGrpcRange: '~1.9.0', overrideRange: undefined })).toMatch(
      /no @firebase\/firestore override/,
    );
  });

  it('fails when the override admits an affected version', () => {
    for (const overrideRange of ['~1.9.0', '^1.13.0', '~1.14.0', '1.14.4', '>=1.10.0', 'not-a-range']) {
      expect(firestoreGrpcOverrideProblem({ firestoreGrpcRange: '~1.9.0', overrideRange }), overrideRange).toMatch(
        /admits an affected version/,
      );
    }
  });

  it('accepts an override on a patched release of either fixed line', () => {
    for (const overrideRange of ['~1.14.5', '1.14.5', '~1.13.6', '>=1.14.5']) {
      expect(firestoreGrpcOverrideProblem({ firestoreGrpcRange: '~1.9.0', overrideRange }), overrideRange).toBeNull();
    }
  });
});
