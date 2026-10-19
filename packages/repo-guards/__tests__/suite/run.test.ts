import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Guard } from '../../src/guard.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import { runGuard } from '../../src/node/suite/run.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let reader: RepoReader;
beforeAll(() => {
  repo = tempRepo({ 'src/index.ts': 'export {};', 'config.json': '{}', 'store.rules': 'service firebase.storage { }' });
  reader = createRepoReader({ repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/index.ts' } }, rulesFiles: ['store.rules'] });
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

  it('passes a guard that reads only one named file', async () => {
    const named = guard((c) => {
      c.file('config.json');
      return [];
    });
    await expect(runGuard(named, reader)).resolves.toBeUndefined();
  });

  it('MUST FAIL — a guard that read no file checked nothing', async () => {
    await expect(runGuard(guard(() => []), reader)).rejects.toThrow('a guard: the guard read no file, so it checked nothing');
  });

  it('MUST FAIL — a scope that reached no file is vacuous, even beside a named file and a scope that reached one', async () => {
    const emptyBesideOthers = guard((c) => {
      c.file('config.json');
      c.files({ roots: ['app'], kinds: ['code'], tests: false });
      c.files({ roots: ['app'], kinds: ['markdown'], tests: false });
      return [];
    });
    await expect(runGuard(emptyBesideOthers, reader)).rejects.toThrow(
      'a guard: its scope reached no file, so it checked nothing there: markdown files under app (tests left out)',
    );
  });

  it('MUST FAIL — rules files of a service the layout lists none of are a vacuous scope', async () => {
    const storage = guard((c) => {
      c.rulesFiles('storage');
      return [];
    });
    await expect(runGuard(storage, reader)).resolves.toBeUndefined();
    const firestore = guard((c) => {
      c.rulesFiles('firestore');
      return [];
    });
    await expect(runGuard(firestore, reader)).rejects.toThrow("its scope reached no file, so it checked nothing there: the layout's firestore rules files");
  });

  it('MUST FAIL — a finding fails the run with the description and every place', async () => {
    const failing = guard((c) => {
      c.file('src/index.ts');
      return [{ file: 'src/index.ts', line: 1, detail: 'the problem' }];
    });
    await expect(runGuard(failing, reader)).rejects.toThrow('a guard: 1 finding(s)\n\nWhat it requires.\n\n  src/index.ts:1 — the problem');
  });
});
