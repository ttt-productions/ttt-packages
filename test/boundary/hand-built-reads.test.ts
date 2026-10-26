import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
};

const BUILDER_BASELINE =
  'the read builders are held to a real observer that never fetched, so the disabled state they build is the one a real read reaches';

registerSuiteOf(
  {
    layout,
    generic: {
      handBuiltReads: {
        reviewed: [
          {
            path: 'packages/query-core/__tests__/react/testing-builders.test.tsx',
            anchor: "queryKey: ['off'], enabled: false",
            why: BUILDER_BASELINE,
          },
          {
            path: 'packages/query-core/__tests__/react/testing-builders.test.tsx',
            anchor: "queryKey: ['off-infinite'], enabled: false",
            why: BUILDER_BASELINE,
          },
        ],
      },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => definition.id === 'handBuiltReads'),
);
