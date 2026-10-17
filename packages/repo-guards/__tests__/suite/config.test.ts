import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configProblems, type GenericGuardDefinition } from '../../src/config.js';
import { GENERIC_GUARDS } from '../../src/registry.js';
import type { RepoLayout } from '../../src/reader/layout.js';
import { matchPattern, ownerOnly } from '../../src/shapes/shapes.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let layout: RepoLayout;
beforeAll(() => {
  repo = tempRepo({ 'src/index.ts': 'export {};' });
  layout = { repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/index.ts' } } };
});
afterAll(() => repo.remove());

/** Two stand-in generic guards: one every app runs, one an app may declare absent. */
const always: GenericGuardDefinition<{ owner: string }> = {
  id: 'always',
  absentWhen: false,
  factProblems: (f) => (f?.owner ? [] : ['owner is missing']),
  build: () => [],
};
const optional: GenericGuardDefinition<{ x: number }> = {
  id: 'optional',
  absentWhen: 'the app has no such feature',
  factProblems: () => [],
  build: () => [],
};
const DEFINITIONS = [always, optional] as ReadonlyArray<GenericGuardDefinition<never>>;

const business = () =>
  ownerOnly({
    title: 'one owner',
    description: 'd',
    scope: { roots: ['app'], kinds: ['code'], tests: false },
    match: matchPattern(/x/),
    owners: ['src/index.ts'],
    samples: { flags: ['x'], passes: ['y'] },
  });

describe('a guard config', () => {
  it('runs when every generic guard has its facts or an allowed absence', () => {
    expect(configProblems({ layout, generic: { always: { owner: 'a' }, optional: { absent: 'no such feature' } }, business: [business()] }, DEFINITIONS)).toEqual([]);
  });

  it('MUST FAIL — a missing guard, an unknown guard, a forbidden or unexplained absence, bad facts, and a duplicate business title', () => {
    expect(configProblems({ layout, generic: { always: { absent: 'not wanted' }, stray: {} }, business: [business(), business()] }, DEFINITIONS)).toEqual([
      'generic.stray names no guard this package carries',
      'generic.always cannot be declared absent: every app runs it',
      'generic.optional is missing — every guard needs its facts or an { absent: why }',
      'two business guards share the title "one owner"',
    ]);
    expect(configProblems({ layout, generic: { always: {}, optional: { absent: ' ' } }, business: [] }, DEFINITIONS)).toEqual([
      'generic.always: owner is missing',
      'generic.optional is declared absent with no why',
    ]);
  });
});

describe("the package's own generic guards", () => {
  it('each has a unique id, and refuses missing facts with problems rather than a crash', () => {
    const ids = GENERIC_GUARDS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const wrong: string[] = [];
    for (const definition of GENERIC_GUARDS) {
      try {
        if (!(definition.factProblems as (f: unknown) => string[])(undefined).length) wrong.push(`${definition.id}: accepted no facts at all`);
      } catch (error) {
        wrong.push(`${definition.id}: crashed (${(error as Error).message})`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('an empty config names every generic guard as missing', () => {
    const problems = configProblems({ layout, generic: {}, business: [] }, GENERIC_GUARDS);
    for (const { id } of GENERIC_GUARDS) expect(problems.some((p) => p.startsWith(`generic.${id} is missing`)), id).toBe(true);
  });
});
