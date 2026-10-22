import { afterEach, describe, expect, it } from 'vitest';
import {
  sharedFakeGuard,
  sharedFakeReport,
  type SharedFakeFacts,
} from '../../src/modules/repo/shared-fakes.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const UI_FAKE = 'src/test/fakes/ui-kit.ts';
const AUTH_FAKE = 'src/test/fakes/use-auth.ts';
const HELPERS = 'src/test/helpers.ts';

const BASE: Record<string, string> = {
  'src/app/page.tsx': 'export const page = 1;',
  'src/hooks/use-auth.ts': 'export const useAuth = () => null;',
  [UI_FAKE]: 'export const uiFake = (io: unknown, overrides = {}) => ({ ...overrides });',
  [AUTH_FAKE]: 'export const authFake = () => ({});',
  [HELPERS]: 'export function makeRequest() { return {}; }\nexport const makeWrapper = () => null;',
  'functions/src/run.ts': 'export const run = 1;',
};

const FACTS: SharedFakeFacts = {
  importAliases: { '@/': 'src/' },
  fakes: [
    { module: '@scope/ui-kit/react', owner: UI_FAKE },
    { module: 'src/hooks/use-auth.ts', owner: AUTH_FAKE },
  ],
  helperOwners: [HELPERS],
};

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

function readerOf(files: Record<string, string>): RepoReader {
  repo = tempRepo({ ...BASE, ...files });
  return createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/app/page.tsx' },
      functions: { path: 'functions/src', anchor: 'functions/src/run.ts' },
    },
    testCodePaths: [{ path: 'src/test', why: 'the shared fakes, helpers, and setup' }],
  });
}

async function findingsOf(files: Record<string, string>, facts: SharedFakeFacts = FACTS) {
  const reader = readerOf(files);
  const [fakes, helpers] = sharedFakeGuard.build(facts);
  const context = contextOf(reader);
  return {
    fakes: (await fakes.run(context)).map((f) => `${f.file} ${f.detail}`),
    helpers: (await helpers.run(context)).map((f) => `${f.file} ${f.detail}`),
  };
}

describe('a module with a shared fake is faked only through it', () => {
  it('passes a mock whose factory loads the owner, by alias or relative path, with or without overrides', async () => {
    const { fakes } = await findingsOf({
      'src/test/setup.ts':
        "vi.mock('@scope/ui-kit/react', async (io) => (await import('./fakes/ui-kit')).uiFake(io));",
      'src/__tests__/a.test.ts': [
        "vi.mock('@scope/ui-kit/react', async (io) =>",
        "  (await import('@/test/fakes/ui-kit')).uiFake(io, { toast: vi.fn() }));",
        "vi.mock('@/hooks/use-auth', async () => (await import('../test/fakes/use-auth.ts')).authFake());",
      ].join('\n'),
    });
    expect(fakes).toEqual([]);
  });

  it('FLAGS a hand-written factory and a mock with no factory, for a package and a local module alike', async () => {
    const { fakes } = await findingsOf({
      'src/__tests__/a.test.ts': [
        "vi.mock('@scope/ui-kit/react', () => ({ toast: vi.fn() }));",
        "vi.doMock('../hooks/use-auth', () => ({ useAuth: () => null }));",
        "vi.mock('@/hooks/use-auth.js');",
      ].join('\n'),
    });
    expect(fakes).toEqual([
      `src/__tests__/a.test.ts fakes @scope/ui-kit/react by hand — its fake is ${UI_FAKE}: load it in the mock's factory and pass this test's overrides`,
      `src/__tests__/a.test.ts fakes src/hooks/use-auth.ts by hand — its fake is ${AUTH_FAKE}: load it in the mock's factory and pass this test's overrides`,
      `src/__tests__/a.test.ts fakes src/hooks/use-auth.ts with no factory — its fake is ${AUTH_FAKE}: load it in the mock's factory`,
    ]);
  });

  it('FLAGS a factory that loads some other module instead of the owner', async () => {
    const { fakes } = await findingsOf({
      'src/__tests__/a.test.ts':
        "vi.mock('@scope/ui-kit/react', async () => ({ ...(await import('@/test/fakes/use-auth')) }));",
    });
    expect(fakes).toHaveLength(1);
  });

  it('passes a module with no shared fake, and a tree the owner does not live in', async () => {
    const { fakes } = await findingsOf({
      'src/__tests__/a.test.ts': "vi.mock('@scope/other', () => ({ x: 1 }));",
      'functions/src/run.test.ts': "vi.mock('@scope/ui-kit/react', () => ({ toast: vi.fn() }));",
    });
    expect(fakes).toEqual([]);
  });

  it('FLAGS a shared fake whose owner or module is gone, whose owner is not test code, or that has two owners in one tree', async () => {
    const { fakes } = await findingsOf(
      { 'src/lib/fake.ts': 'export const fake = 1;' },
      {
        ...FACTS,
        fakes: [
          { module: 'src/hooks/gone.ts', owner: AUTH_FAKE },
          { module: '@scope/a', owner: 'src/test/fakes/missing.ts' },
          { module: '@scope/b', owner: 'src/lib/fake.ts' },
          { module: '@scope/ui-kit/react', owner: UI_FAKE },
          { module: '@scope/ui-kit/react', owner: AUTH_FAKE },
        ],
      },
    );
    expect(fakes).toEqual([
      `${AUTH_FAKE} the faked module src/hooks/gone.ts no longer exists — drop its shared fake`,
      'src/test/fakes/missing.ts the shared fake owner src/test/fakes/missing.ts no longer exists',
      'src/lib/fake.ts the shared fake owner src/lib/fake.ts is not test code — a shared fake or helper lives with the tests',
      `${AUTH_FAKE} @scope/ui-kit/react has two shared fakes in one tree (${UI_FAKE} and ${AUTH_FAKE}) — keep one`,
    ]);
  });

  it('never reads a mock written in a comment or a string', async () => {
    const { fakes } = await findingsOf({
      'src/__tests__/a.test.ts':
        "// vi.mock('@scope/ui-kit/react', () => ({}));\nconst s = \"vi.mock('@scope/ui-kit/react')\";",
    });
    expect(fakes).toEqual([]);
  });
});

describe('a shared helper is never declared again in a test file of its tree', () => {
  it('FLAGS a function declaration and a variable holding a function that repeat a shared helper', async () => {
    const { helpers } = await findingsOf({
      'src/__tests__/a.test.ts':
        "function makeRequest() { return 1; }\ndescribe('x', () => { const makeWrapper = () => null; });",
    });
    expect(helpers).toEqual([
      `src/__tests__/a.test.ts declares makeRequest, which the shared helpers in ${HELPERS} export — import it from there`,
      `src/__tests__/a.test.ts declares makeWrapper, which the shared helpers in ${HELPERS} export — import it from there`,
    ]);
  });

  it('passes an import of the helper, a non-function of the same name, and another tree', async () => {
    const { helpers } = await findingsOf({
      'src/__tests__/a.test.ts':
        "import { makeRequest } from '@/test/helpers';\nconst makeWrapper = 1;\nmakeRequest();",
      'functions/src/run.test.ts': 'function makeRequest() { return 1; }',
    });
    expect(helpers).toEqual([]);
  });

  it('FLAGS a shared helper file that is gone', async () => {
    const { helpers } = await findingsOf({}, { ...FACTS, helperOwners: ['src/test/gone.ts'] });
    expect(helpers).toEqual([
      'src/test/gone.ts the shared helper file src/test/gone.ts no longer exists',
    ]);
  });
});

describe('the facts', () => {
  it('accepts an app with no shared fake or helper yet', () => {
    expect(
      sharedFakeGuard.factProblems({ importAliases: {}, fakes: [], helperOwners: [] }),
    ).toEqual([]);
  });

  it('refuses missing lists, a fake listed twice, and paths that are not repo-relative', () => {
    expect(
      sharedFakeGuard.factProblems({ importAliases: {} } as unknown as SharedFakeFacts),
    ).toEqual([
      'fakes is missing (declare [] when there is none)',
      'helperOwners is missing (declare [] when there is none)',
    ]);
    const fake = { module: '@scope/a', owner: 'src/test/a.ts' };
    expect(
      sharedFakeGuard.factProblems({
        importAliases: { '@/': '' },
        fakes: [fake, fake, { module: 'C:\\src\\b.ts', owner: 'src/test/b.ts' }],
        helperOwners: ['src/test/h.ts/'],
      }),
    ).toEqual([
      'importAliases @/ needs a target folder',
      'fakes lists @scope/a with src/test/a.ts twice',
      "fakes entry C:\\src\\b.ts's module (C:\\src\\b.ts) must be repo-relative and forward-slashed",
      'a helperOwners entry (src/test/h.ts/) must not end with a slash',
    ]);
  });
});

describe('the report of copies with no shared owner', () => {
  it('lists modules faked and helpers declared in several test files of one tree, and nothing with an owner or one copy', () => {
    const reader = readerOf({
      'src/__tests__/a.test.ts':
        "vi.mock('@scope/copied', () => ({}));\nvi.mock('@scope/once', () => ({}));\nvi.mock('@scope/ui-kit/react', () => ({}));\nconst render = () => null;\nfunction makeRequest() {}",
      'src/__tests__/b.test.ts':
        "vi.mock('@scope/copied', () => ({ x: 1 }));\nvi.mock('@scope/ui-kit/react', () => ({}));\nfunction render() {}\nfunction makeRequest() {}",
      'functions/src/run.test.ts': "vi.mock('@scope/copied', () => ({}));",
    });
    expect(sharedFakeReport(reader, FACTS)).toEqual({
      modules: [
        {
          root: 'app',
          module: '@scope/copied',
          files: ['src/__tests__/a.test.ts', 'src/__tests__/b.test.ts'],
        },
      ],
      helpers: [
        {
          root: 'app',
          name: 'render',
          files: ['src/__tests__/a.test.ts', 'src/__tests__/b.test.ts'],
        },
      ],
    });
  });
});
