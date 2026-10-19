import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

// No wildcard import of a package, run over this repository through the suite entry, exactly as an
// app's suite runs it: every package, script, and boundary test names each package definition it
// uses. The guard's own must-fail and must-pass cases are proven in repo-guards' tests.

const layout: RepoLayout = { repoRoot: REPO_ROOT, roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } } };
registerSuiteOf(
  { layout, generic: { packageWildcardImports: { scope: '@ttt-productions' } }, business: [] },
  GENERIC_GUARDS.filter((definition) => definition.id === 'packageWildcardImports'),
);
