import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
};
registerSuiteOf(
  { layout, generic: { swallowedRejections: { reviewed: [] } }, business: [] },
  GENERIC_GUARDS.filter((definition) => definition.id === 'swallowedRejections'),
);
