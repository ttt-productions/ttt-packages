import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

// Firestore pins @grpc/grpc-js to a line that GHSA-m9gg-hp2v-232j (high) affects and that never
// received the fix, so the gate's `npm audit --omit=dev --audit-level=high` fails on firebase
// itself. That audit command and its threshold are the publish gate and never change; the root
// package.json instead carries an override scoped to Firestore that lifts @grpc/grpc-js to a
// patched release. The shared override guard keeps it honest and is the trigger to delete it: it
// fails the moment Firestore declares a range that reaches no affected version. The guard's own
// cases are proven in its package's tests.

const layout: RepoLayout = { repoRoot: REPO_ROOT, roots: { app: { path: '.', anchor: 'package.json' } } };

registerSuiteOf(
  {
    layout,
    generic: {
      dependencyOverrides: {
        overrides: [
          {
            manifest: 'package.json',
            installedUnder: '',
            parent: '@firebase/firestore',
            child: '@grpc/grpc-js',
            // The 1.14 line stayed affected until 1.14.5.
            affected: '<1.13.6 || >=1.14.0 <1.14.5',
            why: 'Firestore pins an @grpc/grpc-js line GHSA-m9gg-hp2v-232j affects, and the publish audit fails on it',
          },
        ],
      },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => definition.id === 'dependencyOverrides'),
);
