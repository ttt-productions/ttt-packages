import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

// One package entry per definition, run over this repository through the suite entry, exactly as an
// app's suite runs it: every package's own entries (read from source) export each definition from its
// folder's entry alone, and every package, script, and boundary test that imports another package
// names each definition from the entry that owns it (read from the installed builds). The guards' own
// must-fail and must-pass cases are proven in repo-guards' tests.

const layout: RepoLayout = { repoRoot: REPO_ROOT, roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } } };
registerSuiteOf(
  { layout, generic: { packageEntries: { packagesFolder: 'packages' }, packageEntryImports: { scope: '@ttt-productions' } }, business: [] },
  GENERIC_GUARDS.filter((definition) => definition.id === 'packageEntries' || definition.id === 'packageEntryImports'),
);
