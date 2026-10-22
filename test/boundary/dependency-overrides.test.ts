import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'package.json' } },
};

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
