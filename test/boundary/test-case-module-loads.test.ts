import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
};
registerSuiteOf(
  {
    layout,
    generic: {
      testCaseModuleLoads: {
        localAliases: [],
        reviewed: [
          {
            path: 'packages/module-core/__tests__/lazy-module.test.ts',
            why: "proves lazyModule's loader under concurrent callers and the vitest behaviour it exists for: the in-case import of the mocked fixture is the load under test",
          },
        ],
      },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => definition.id === 'testCaseModuleLoads'),
);
