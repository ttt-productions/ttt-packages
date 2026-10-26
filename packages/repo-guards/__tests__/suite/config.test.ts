import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configProblems, type GenericGuardDefinition } from '../../src/node/suite/config.js';
import { GENERIC_GUARDS } from '../../src/node/suite/registry.js';
import type { RepoLayout } from '../../src/node/layout.js';
import { matchPattern, ownerOnly } from '../../src/shapes/shapes.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let layout: RepoLayout;
beforeAll(() => {
  repo = tempRepo({
    'src/index.ts': 'export {};',
    'functions/src/index.ts': 'export {};',
    'edge/src/index.ts': 'export {};',
  });
  layout = { repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/index.ts' } } };
});
afterAll(() => repo.remove());

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
    expect(
      configProblems(
        {
          layout,
          generic: { always: { owner: 'a' }, optional: { absent: 'no such feature' } },
          business: [business()],
        },
        DEFINITIONS,
      ),
    ).toEqual([]);
  });

  it('MUST FAIL — a missing guard, an unknown guard, a forbidden or unexplained absence, bad facts, and a duplicate business title', () => {
    expect(
      configProblems(
        {
          layout,
          generic: { always: { absent: 'not wanted' }, stray: {} },
          business: [business(), business()],
        },
        DEFINITIONS,
      ),
    ).toEqual([
      'generic.stray names no guard this package carries',
      'generic.always cannot be declared absent: every app runs it',
      'generic.optional is missing — every guard needs its facts or an { absent: why }',
      'two business guards share the title "one owner"',
    ]);
    expect(
      configProblems(
        { layout, generic: { always: {}, optional: { absent: ' ' } }, business: [] },
        DEFINITIONS,
      ),
    ).toEqual([
      'generic.always: owner is missing',
      'generic.optional is declared absent with no why',
    ]);
  });
});

describe('a declared absence of a guard over one tree', () => {
  const overFunctions: GenericGuardDefinition<never> = {
    id: 'overFunctions',
    absentWhen: 'the app has no Functions tree',
    absentOnlyWithoutRoot: 'functions',
    factProblems: () => [],
    build: () => [],
  };
  const overWorkers: GenericGuardDefinition<never> = {
    id: 'overWorkers',
    absentWhen: 'the app deploys no Worker',
    absentOnlyWithoutRoot: 'workers',
    factProblems: () => [],
    build: () => [],
  };
  const absent = {
    overFunctions: { absent: 'no Functions tree' },
    overWorkers: { absent: 'no Worker' },
  };

  it('is allowed where the layout declares no root of that tree', () => {
    expect(
      configProblems({ layout, generic: absent, business: [] }, [overFunctions, overWorkers]),
    ).toEqual([]);
  });

  it('MUST FAIL — an absence the layout contradicts, with a Functions root or a Worker root declared', () => {
    const withTrees: RepoLayout = {
      ...layout,
      roots: {
        ...layout.roots,
        functions: { path: 'functions/src', anchor: 'functions/src/index.ts' },
        workers: { edge: { path: 'edge', anchor: 'edge/src/index.ts' } },
      },
    };
    expect(
      configProblems({ layout: withTrees, generic: absent, business: [] }, [
        overFunctions,
        overWorkers,
      ]),
    ).toEqual([
      'generic.overFunctions is declared absent, but the layout declares a functions root for it to check',
      'generic.overWorkers is declared absent, but the layout declares a workers root for it to check',
    ]);
  });

  it("binds each of the package's per-tree guards to its tree", () => {
    const bound = Object.fromEntries(
      GENERIC_GUARDS.filter((d) => d.absentOnlyWithoutRoot).map((d) => [
        d.id,
        d.absentOnlyWithoutRoot,
      ]),
    );
    expect(bound).toEqual({
      retryLoopActions: 'e2e',
      secretBindings: 'functions',
      swallowedE2eActions: 'e2e',
      testSourceRoot: 'functions',
      workerBoundedBody: 'workers',
      workerConfigIsolation: 'workers',
    });
  });
});

describe("the package's own generic guards", () => {
  it('each has a unique id, and refuses missing facts with problems rather than a crash', () => {
    const ids = GENERIC_GUARDS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const wrong: string[] = [];
    for (const definition of GENERIC_GUARDS) {
      try {
        if (!(definition.factProblems as (f: unknown) => string[])(undefined).length)
          wrong.push(`${definition.id}: accepted no facts at all`);
      } catch (error) {
        wrong.push(`${definition.id}: crashed (${(error as Error).message})`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('MUST FAIL — an import alias with no target folder, in every guard that takes import aliases', () => {
    const aliasFacts = {
      importPaths: { importAliases: { '@/': undefined } },
      firestoreWrites: { importAliases: { '@/': undefined } },
      adminActionSurface: { importAliases: { '@/': undefined } },
      isolatedRoots: { importAliases: { '@/': undefined } },
      sharedFakes: { importAliases: { '@/': undefined } },
      testTimeouts: { importAliases: { '@/': undefined } },
      partialMocks: {
        packageRoots: [{ module: 'zod', why: 'w' }],
        passThroughHelpers: [],
        sharedFakes: { importAliases: { '@/': undefined } },
      },
    };
    for (const [id, facts] of Object.entries(aliasFacts)) {
      const definition = GENERIC_GUARDS.filter((d) => d.id === id);
      const alias = id === 'partialMocks' ? 'sharedFakes.importAliases' : 'importAliases';
      expect(
        configProblems({ layout, generic: { [id]: facts }, business: [] }, definition),
        id,
      ).toContain(`generic.${id}: ${alias} @/ needs a target folder`);
    }
  });

  it('MUST FAIL — a Firestore write guard with no core package', () => {
    const definition = GENERIC_GUARDS.filter((d) => d.id === 'firestoreWrites');
    expect(
      configProblems({ layout, generic: { firestoreWrites: {} }, business: [] }, definition),
    ).toContain('generic.firestoreWrites: corePackage is missing');
  });

  it('an empty config names every generic guard as missing', () => {
    const problems = configProblems({ layout, generic: {}, business: [] }, GENERIC_GUARDS);
    for (const { id } of GENERIC_GUARDS)
      expect(
        problems.some((p) => p.startsWith(`generic.${id} is missing`)),
        id,
      ).toBe(true);
  });
});
