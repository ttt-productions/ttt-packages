import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

// A test's time limit names a budget, run over this repository through the suite entry, exactly as
// an app's suite runs it: no package test, boundary test, or script test writes a limit as a number.
// The guard's own must-fail and must-pass cases are proven in repo-guards' tests.

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
  testCodePaths: [
    { path: 'test/timeouts.ts', why: 'the budgets every package test names, imported only by tests' },
  ],
};
registerSuiteOf(
  {
    layout,
    generic: {
      testTimeouts: { importAliases: {}, timeoutFiles: ['test/timeouts.ts'] },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => definition.id === 'testTimeouts'),
);
