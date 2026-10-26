import { afterEach, describe, expect, it } from 'vitest';
import { handBuiltReadGuard, handBuiltReads } from '../../src/modules/repo/hand-built-reads.js';
import { createRepoReader } from '../../src/node/reader.js';
import type { AnchoredEntry } from '../../src/support/anchored-review.js';
import { contextOf } from '../helpers/context.js';
import { factProblemsOf } from '../helpers/configured.js';
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
  const [guard] = handBuiltReadGuard.build({ reviewed });
  const findings = await guard.run(contextOf(reader));
  return findings.map((f) => `${f.file}:${f.line ?? '-'} ${f.detail}`);
}

describe('no test builds a read’s state by hand', () => {
  it('flags a retryState literal, a ReadRetryState literal, a result read off a constructed observer, and a hand-seeded cache', () => {
    for (const code of [
      'const read = { ...result, retryState: { error: null, isRetrying: false, isLoading: false } };',
      "const read = { 'retryState': ({ error, isRetrying: false, isLoading: false }) };",
      'const settled: ReadRetryState = { error: null, isRetrying: false, isLoading: false };',
      'const r = new QueryObserver(client, { queryKey }).getCurrentResult();',
      [
        'const o = new InfiniteQueryObserver(client, spec);',
        'const r = o.getCurrentResult();',
      ].join('\n'),
      'client.getQueryCache().build(client, { queryKey }).setState({ status: "error" });',
    ])
      expect(handBuiltReads(code), code).toHaveLength(1);
  });

  it('passes a retryState taken from a builder or a real hook, an observer subscribed to a real query, and a cache written through the client', () => {
    for (const code of [
      'const read = { ...result, retryState: failedRead(error).retryState };',
      'const read = { ...result, retryState: profile.retryState };',
      'const read = { ...result, retryState };',
      'const state: ReadRetryState = failedRead(error).retryState;',
      'client.setQueryData(key, data);',
      'store.setState({ ready: true });',
      'const observer = new MutationObserver(client, options);',
      [
        'const observer = new QueryObserver(client, { queryKey, queryFn });',
        'observer.subscribe(() => calls++);',
        "expect(observer.getCurrentResult().fetchStatus).toBe('fetching');",
      ].join('\n'),
      [
        'function a() { const real = new QueryObserver(client, spec); real.subscribe(f); }',
        'function b() { const real = harness(); return real.getCurrentResult(); }',
      ].join('\n'),
      'const r = real.observer.getCurrentResult();',
    ])
      expect(handBuiltReads(code), code).toEqual([]);
  });

  it('reads only test files, and excuses only the one construct a reviewed anchor names', async () => {
    const reviewed = [
      {
        path: 'src/builders.test.ts',
        anchor: 'new QueryObserver(client, real)',
        why: 'the builders are held to a real observer in each state',
      },
    ];
    expect(
      await findingsOf(
        {
          'src/builders.test.ts': [
            'new QueryObserver(client, real).getCurrentResult();',
            'const r = { retryState: { error: null } };',
          ].join('\n'),
          'src/builders.ts': 'export const r = new QueryObserver(client, real).getCurrentResult();',
        },
        reviewed,
      ),
    ).toEqual(['src/builders.test.ts:2 a read’s retryState is written as a literal']);
  });

  it('fails a reviewed entry that no longer names a hand-built read', async () => {
    const findings = await findingsOf({ 'src/a.test.ts': 'export {};' }, [
      { path: 'src/a.test.ts', anchor: 'getCurrentResult()', why: 'gone' },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/its anchor names no hand-built read/);
  });

  it('needs the reviewed list', () => {
    expect(factProblemsOf(handBuiltReadGuard, {})).not.toEqual([]);
    expect(factProblemsOf(handBuiltReadGuard, { reviewed: [] })).toEqual([]);
  });
});
