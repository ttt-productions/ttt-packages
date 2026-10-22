import { describe, expect, it } from 'vitest';
import { checkPlaybookRefs } from '@ttt-productions/repo-guards/node/tooling';
import { REPO_ROOT } from './leak-utils';

const SHARED_PLAYBOOKS = {
  dir: 'packages/dev-standards/playbooks',
  refsRoot: 'packages/dev-standards',
  pathPrefixes: ['rules', 'playbooks', 'workflows', 'claude', 'work', 'runbooks', 'config'],
  rootFiles: [],
  minChecked: 1,
} as const;

describe('boundary: the shared playbooks', () => {
  it('every reference in the shared playbooks resolves inside the package', () => {
    const result = checkPlaybookRefs({ repoRoot: REPO_ROOT, folders: [SHARED_PLAYBOOKS] });
    expect(result.shortfalls).toEqual([]);
    expect(result.misses).toEqual([]);
  });
});
