import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Guard } from '../../src/guard.js';
import { createRepoReader, type RepoReader } from '../../src/reader/reader.js';
import { runGuard } from '../../src/suite/run.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let reader: RepoReader;
beforeAll(() => {
  repo = tempRepo({ 'src/index.ts': 'export {};' });
  reader = createRepoReader({ repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/index.ts' } } });
});
afterAll(() => repo.remove());

const guard = (run: Guard['run']): Guard => ({ title: 'a guard', description: 'What it requires.', run });

describe('running one guard', () => {
  it('passes a guard that read files and found nothing', async () => {
    const clean = guard((c) => {
      c.files({ roots: ['app'], kinds: ['code'], tests: false });
      return [];
    });
    await expect(runGuard(clean, reader)).resolves.toBeUndefined();
  });

  it('MUST FAIL — a guard that read no file checked nothing', async () => {
    await expect(runGuard(guard(() => []), reader)).rejects.toThrow(/read no file, so it checked nothing/);
    const emptyScope = guard((c) => {
      c.files({ roots: ['app'], kinds: ['markdown'], tests: false });
      return [];
    });
    await expect(runGuard(emptyScope, reader)).rejects.toThrow(/read no file/);
  });

  it('MUST FAIL — a finding fails the run with the description and every place', async () => {
    const failing = guard((c) => {
      c.file('src/index.ts');
      return [{ file: 'src/index.ts', line: 1, detail: 'the problem' }];
    });
    await expect(runGuard(failing, reader)).rejects.toThrow('a guard: 1 finding(s)\n\nWhat it requires.\n\n  src/index.ts:1 — the problem');
  });
});
