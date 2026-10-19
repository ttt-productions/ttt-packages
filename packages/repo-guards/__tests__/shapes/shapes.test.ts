import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GuardContext } from '../../src/guard.js';
import { createRepoReader, type Scope } from '../../src/node/reader.js';
import type { RepoLayout } from '../../src/node/layout.js';
import { declaredLiteral, matchPattern, ownerOnly, reviewedAllowlist, sampleHits } from '../../src/shapes/shapes.js';
import { checkSamples } from '../../src/suite/run.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let layout: RepoLayout;

beforeAll(() => {
  repo = tempRepo({
    'src/config/provider.ts': "const doc = readConfig('app'); // readConfig in a comment never counts",
    'src/config/second.ts': "export const x = readConfig('app');",
    'src/ui/card.tsx': "export const a = readConfig('app');\nexport const b = 1;",
    'src/ui/plain.tsx': '// readConfig mentioned only in a comment\nexport const c = 1;',
    'src/ui/legacy.tsx': 'export const d = legacyTimer(); export const e = legacyTimer();',
    'src/copy/notice.ts': "export const NOTICE = 'Payouts are live.';",
    'src/copy/page.tsx': "export const p = 'Payouts are live.';",
  });
  layout = { repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/config/provider.ts' } } };
});

afterAll(() => repo.remove());

const SCOPE: Scope = { roots: ['app'], kinds: ['code'], tests: false };
const context = (): GuardContext => {
  return contextOf(createRepoReader(layout));
};
const readConfig = matchPattern(/\breadConfig\(/);
const samples = { flags: ["readConfig('app')"], passes: ['// readConfig( in a comment'] };

describe('owner-only', () => {
  const guard = (owners: string[]) =>
    ownerOnly({ title: 'config read only by its provider', description: 'Read config through the provider.', scope: SCOPE, match: readConfig, owners, samples });

  it('passes when the pattern appears only in its owners', async () => {
    expect(await guard(['src/config/provider.ts', 'src/config/second.ts', 'src/ui/card.tsx']).run(context())).toEqual([]);
  });

  it('FLAGS the pattern outside its owners, at its line, and never a comment', async () => {
    const findings = await guard(['src/config/provider.ts', 'src/config/second.ts']).run(context());
    expect(findings).toEqual([{ file: 'src/ui/card.tsx', line: 1, detail: 'outside its owner: readConfig(' }]);
  });

  it('FLAGS an owner the pattern no longer appears in, and an owner that is gone', async () => {
    const findings = await guard(['src/config/provider.ts', 'src/config/second.ts', 'src/ui/card.tsx', 'src/ui/plain.tsx', 'src/ui/gone.tsx']).run(context());
    expect(findings.map((f) => f.file)).toEqual(['src/ui/plain.tsx', 'src/ui/gone.tsx']);
    expect(findings[1].detail).toBe('the owner file no longer exists');
  });

  it('proves its matcher through its samples', () => {
    const g = guard(['src/config/provider.ts']);
    expect(sampleHits(g, "readConfig('app')")).toBe(1);
    expect(() => checkSamples(g)).not.toThrow();
  });
});

describe('reviewed allowlist', () => {
  const legacy = matchPattern(/\blegacyTimer\(/);
  const guard = (allowlist: Array<{ path: string; why: string; count?: number }>) =>
    reviewedAllowlist({
      title: 'legacy timers stay on the reviewed list',
      description: 'Use the scheduler.',
      scope: SCOPE,
      match: legacy,
      allowlist,
      samples: { flags: ['legacyTimer()'], passes: ['scheduler()'] },
    });

  it('passes a reviewed file, with its exact count', async () => {
    expect(await guard([{ path: 'src/ui/legacy.tsx', why: 'reviewed', count: 2 }]).run(context())).toEqual([]);
  });

  it('FLAGS a file not on the list', async () => {
    expect((await guard([]).run(context())).map((f) => f.detail)).toEqual(['not on the reviewed list: legacyTimer(', 'not on the reviewed list: legacyTimer(']);
  });

  it('FLAGS more uses than reviewed, fewer than reviewed, and an entry that matches nothing', async () => {
    expect((await guard([{ path: 'src/ui/legacy.tsx', why: 'reviewed', count: 1 }]).run(context())).map((f) => f.detail)).toEqual([
      'more than the 1 reviewed: legacyTimer(',
    ]);
    expect((await guard([{ path: 'src/ui/legacy.tsx', why: 'reviewed', count: 3 }]).run(context())).map((f) => f.detail)).toEqual([
      'stale count: reviewed 3, found 2',
    ]);
    const stale = await guard([
      { path: 'src/ui/legacy.tsx', why: 'reviewed' },
      { path: 'src/ui/plain.tsx', why: 'once held one' },
    ]).run(context());
    expect(stale.map((f) => f.file)).toEqual(['src/ui/plain.tsx']);
  });

  it('refuses to build with an entry that carries no why, a duplicate, or a bad count', () => {
    expect(() => guard([{ path: 'src/ui/legacy.tsx', why: ' ' }])).toThrow(/allowlist entry src\/ui\/legacy.tsx carries no why/);
    expect(() => guard([{ path: 'a', why: 'x' }, { path: 'a', why: 'y' }])).toThrow(/allowlist lists a twice/);
    expect(() => guard([{ path: 'a', why: 'x', count: 0 }])).toThrow(/count must be a positive whole number/);
  });
});

describe('declared literal', () => {
  const build = (mode: 'banned' | 'owned' | 'covered', literals: string[] | (() => Promise<string[]>), owners?: string[]) =>
    declaredLiteral({
      title: `notice copy (${mode})`,
      description: 'The notice sentence lives in its one declaration.',
      scope: SCOPE,
      literals,
      mode,
      owners,
      samples: { flags: ["'Payouts are live.'"], passes: ["'Bouquets are here.'"] },
    });

  it('banned: FLAGS every occurrence', async () => {
    const g = build('banned', ['Payouts are live.']);
    await g.prepare!();
    expect((await g.run(context())).map((f) => f.file)).toEqual(['src/copy/notice.ts', 'src/copy/page.tsx']);
  });

  it('owned: passes in the owner, FLAGS a restatement elsewhere, and FLAGS an owner that no longer holds it', async () => {
    const g = build('owned', async () => ['Payouts are live.'], ['src/copy/notice.ts', 'src/ui/plain.tsx']);
    await g.prepare!();
    const findings = await g.run(context());
    expect(findings.map((f) => `${f.file} ${f.detail}`)).toEqual([
      'src/copy/page.tsx restated outside its owner: Payouts are live.',
      'src/ui/plain.tsx stale owner: no declared value appears in it (or it is outside the scope)',
    ]);
  });

  it('covered: FLAGS a declared value nothing covers', async () => {
    const g = build('covered', ['Payouts are live.', 'Refunds are live.']);
    await g.prepare!();
    expect((await g.run(context())).map((f) => f.detail)).toEqual(['nothing in the scope covers Refunds are live.']);
  });

  it('fails a run whose declared value list is empty — a guard that checks nothing', async () => {
    await expect(build('banned', async () => []).prepare!()).rejects.toThrow(/declared value list is empty/);
  });

  it('proves its matcher through its samples once its values load', async () => {
    const g = build('banned', async () => ['Payouts are live.']);
    expect(() => checkSamples(g)).toThrow(/never loaded/);
    await g.prepare!();
    expect(() => checkSamples(g)).not.toThrow();
  });
});

describe('MUST FAIL — a malformed business guard never builds', () => {
  it('refuses a guard with no must-fail sample', () => {
    expect(() =>
      ownerOnly({ title: 't', description: 'd', scope: SCOPE, match: readConfig, owners: ['a'], samples: { flags: [], passes: ['x'] } }),
    ).toThrow(/no must-fail sample/);
  });

  it('refuses an owner-only guard with no owner, and an owned literal with no owner', () => {
    expect(() => ownerOnly({ title: 't', description: 'd', scope: SCOPE, match: readConfig, owners: [], samples })).toThrow(/names no owner file/);
    expect(() => declaredLiteral({ title: 't', description: 'd', scope: SCOPE, literals: ['x'], mode: 'owned', samples })).toThrow(
      /an owned literal names no owner file/,
    );
  });

  it('FLAGS a matcher that stopped catching its must-fail sample', () => {
    const blind = ownerOnly({
      title: 'blind',
      description: 'd',
      scope: SCOPE,
      match: matchPattern(/\bnothingMatchesThis\(/),
      owners: ['a'],
      samples,
    });
    expect(() => checkSamples(blind)).toThrow(/must-fail samples it did not flag/);
  });
});
