import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

// A test loads the code it tests when its file loads, run over this repository through the suite
// entry, exactly as an app's suite runs it: no package test, boundary test, or script test resets the
// module registry or imports package code inside a case. The guard's own must-fail and must-pass
// cases are proven in repo-guards' tests.

const layout: RepoLayout = { repoRoot: REPO_ROOT, roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } } };
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
