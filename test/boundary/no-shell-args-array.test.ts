import { describe, expect, it } from 'vitest';
import { createRepoReader, type RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
};

registerSuiteOf(
  { layout, generic: { shellSafeChildProcesses: {} }, business: [] },
  GENERIC_GUARDS.filter((definition) => definition.id === 'shellSafeChildProcesses'),
);

describe('boundary: the quiet gate runs its stages through the shared runner', () => {
  const source = createRepoReader(layout).file('scripts/test-quiet.mjs').text;

  it("hands its stages to repo-guards' runQuietGate, whose command runner refuses an unsafe token", () => {
    expect(source).toMatch(/await runQuietGate\(/);
  });

  it('spawns nothing itself but the one fixed command line that builds the runner', () => {
    const spawns = source.match(/\bspawn(?:Sync)?\(|\bexec(?:File)?(?:Sync)?\(/g) ?? [];
    expect(spawns).toEqual(['spawnSync(']);
    expect(source).toMatch(/spawnSync\('npm run build -w @ttt-productions\/repo-guards', \{/);
  });
});
