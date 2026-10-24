import { afterEach, describe, expect, it } from 'vitest';
import { blanketCastGuard, blanketCasts } from '../../src/modules/repo/blanket-casts.js';
import { createRepoReader } from '../../src/node/reader.js';
import type { AnchoredEntry } from '../../src/support/anchored-review.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

async function findingsOf(files: Record<string, string>, reviewed: AnchoredEntry[] = []) {
  repo?.remove();
  repo = tempRepo({ 'src/index.ts': 'export {};', ...files });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/index.ts' } },
  });
  const [guard] = blanketCastGuard.build({ reviewed });
  const findings = await guard.run(contextOf(reader));
  return findings.map((f) => `${f.file}:${f.line ?? '-'} ${f.detail}`);
}

describe('no cast switches type checking off', () => {
  it('flags `as never`, `<never>`, and `as unknown as X`, parenthesised or not', () => {
    expect(blanketCasts('run(db as never);')).toHaveLength(1);
    expect(blanketCasts('run(<never>db);')).toHaveLength(1);
    expect(blanketCasts('const r = ref as unknown as DocRef;')).toHaveLength(1);
    expect(blanketCasts('const r = (ref as unknown) as DocRef;')).toHaveLength(1);
  });

  it('passes a narrowing cast, `as unknown` alone, `as const`, and a never-typed parameter', () => {
    for (const code of [
      'const s = value as string;',
      'const u = value as unknown;',
      "const k = ['a'] as const;",
      'function fail(x: never): never { throw new Error(String(x)); }',
    ])
      expect(blanketCasts(code), code).toEqual([]);
  });

  it('checks tests too, and excuses only the one cast a reviewed anchor names', async () => {
    const reviewed = [{ path: 'src/a.test.ts', anchor: 'vendor as never', why: 'no other way' }];
    expect(
      await findingsOf({ 'src/a.test.ts': 'run(vendor as never);\nrun(db as never);' }, reviewed),
    ).toEqual(['src/a.test.ts:2 an `as never` cast switches type checking off for the value']);
  });

  it('reports a stale reviewed entry', async () => {
    const reviewed = [{ path: 'src/a.ts', anchor: 'db as never', why: 'no other way' }];
    expect(await findingsOf({ 'src/a.ts': 'run(db);' }, reviewed)).toEqual([
      'src/a.ts:- stale reviewed entry "db as never": its anchor names no blanket cast',
    ]);
  });
});
