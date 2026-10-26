import { afterEach, describe, expect, it } from 'vitest';
import { typedMockGuard, type TypedMockFacts } from '../../src/modules/repo/typed-mocks.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';
import { factProblemsOf } from '../helpers/configured.js';

const UI_FAKE = 'src/test/fakes/ui-kit.ts';
const OVERRIDES = 'src/test/fakes/with-overrides.ts';

const BASE: Record<string, string> = {
  'src/app/page.tsx': 'export const page = 1;',
  'src/hooks/use-thing.ts': 'export const useThing = () => null;',
  [UI_FAKE]: 'export const uiFake = (io: unknown, overrides = {}) => ({ ...overrides });',
  [OVERRIDES]:
    'export const passThroughFake = () => async (io: unknown, o = {}) => o;\n' +
    'export const moduleStub = (o: unknown) => o;\nexport const loose = (o: unknown) => o;',
  'functions/src/run.ts': 'export const run = 1;',
};

const FACTS: TypedMockFacts = {
  importAliases: { '@/': 'src/' },
  fakes: [{ module: '@scope/ui-kit/react', owner: UI_FAKE }],
  typedHelpers: [{ owner: OVERRIDES, names: ['passThroughFake', 'moduleStub'] }],
  forbiddenOverrides: [
    {
      module: '@scope/ui-kit/react',
      names: ['Button', 'AccordionContent'],
      why: 'its pending state and its collapsed content are what the cases prove',
    },
  ],
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

async function findingsOf(files: Record<string, string>, facts: TypedMockFacts = FACTS) {
  const reader = readerOf(files);
  const [typed, forbidden] = typedMockGuard.build(facts);
  const context = contextOf(reader);
  return {
    typed: (await typed.run(context)).map((f) => `${f.file}:${f.line} ${f.detail}`),
    forbidden: (await forbidden.run(context)).map((f) => `${f.file}:${f.line} ${f.detail}`),
  };
}

describe('every module mock is typed against the module it replaces', () => {
  it('passes a factory that returns through a shared fake or a typed helper, in each form', async () => {
    const { typed } = await findingsOf({
      'src/__tests__/a.test.ts': [
        "vi.mock('@scope/ui-kit/react', async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io));",
        "vi.mock('@/hooks/use-thing', async (io) =>",
        "  (await import('../test/fakes/with-overrides')).passThroughFake<typeof import('@/hooks/use-thing')>()(io, {}));",
        "vi.mock('@/hooks/use-thing', async () => {",
        "  const { moduleStub } = await import('@/test/fakes/with-overrides');",
        '  return moduleStub({ useThing: () => null });',
        '});',
        "vi.doMock('@/hooks/use-thing', async () => {",
        "  const helpers = await import('@/test/fakes/with-overrides');",
        '  return helpers.moduleStub({});',
        '});',
        "vi.mock('@/hooks/use-thing');",
      ].join('\n'),
    });
    expect(typed).toEqual([]);
  });

  it('FLAGS a hand-written factory, a spread of the real module, and a helper the facts do not list', async () => {
    const { typed } = await findingsOf({
      'src/__tests__/a.test.ts': [
        "vi.mock('@/hooks/use-thing', () => ({ useThing: () => null }));",
        "vi.mock('@scope/ui-kit/react', async (io) => ({ ...(await io()), toast: vi.fn() }));",
        "vi.mock('@/hooks/use-thing', async () => (await import('@/test/fakes/with-overrides')).loose({}));",
      ].join('\n'),
    });
    expect(typed.map((line) => line.split(' mocks ')[0])).toEqual([
      'src/__tests__/a.test.ts:1',
      'src/__tests__/a.test.ts:2',
      'src/__tests__/a.test.ts:3',
    ]);
    expect(typed[0]).toMatch(/never compares to the module/);
  });

  it('reads Functions tests too, and never the typed owners themselves', async () => {
    const { typed } = await findingsOf({
      'functions/src/run.test.ts': "vi.mock('./run.js', () => ({ run: 2 }));",
      'src/test/fakes/ui-kit.ts': "vi.mock('x', () => ({}));\nexport const uiFake = () => ({});",
    });
    expect(typed).toEqual([expect.stringMatching(/^functions\/src\/run\.test\.ts:1 /)]);
  });

  it('fails a typed owner that no longer exists', async () => {
    const { typed } = await findingsOf(
      {},
      { ...FACTS, typedHelpers: [{ owner: 'src/test/gone.ts', names: ['moduleStub'] }] },
    );
    expect(typed).toEqual([
      'src/test/gone.ts:undefined this typed fake or helper file no longer exists',
    ]);
  });
});

describe('no test overrides an export whose real behavior every test needs', () => {
  it('FLAGS a listed export overridden through the shared fake or a factory of its own', async () => {
    const { forbidden } = await findingsOf({
      'src/__tests__/a.test.tsx': [
        "vi.mock('@scope/ui-kit/react', async (io) =>",
        "  (await import('@/test/fakes/ui-kit')).uiFake(io, { Button: () => null, Spinner: () => null }));",
        "vi.mock('@scope/ui-kit/react', async (io) => ({ ...(await io()), AccordionContent }));",
      ].join('\n'),
    });
    expect(forbidden).toEqual([
      expect.stringMatching(
        /^src\/__tests__\/a\.test\.tsx:2 overrides @scope\/ui-kit\/react's Button/,
      ),
      expect.stringMatching(
        /:3 overrides @scope\/ui-kit\/react's AccordionContent — the real one runs/,
      ),
    ]);
  });

  it('passes overrides of exports the facts do not list, and other modules', async () => {
    const { forbidden } = await findingsOf({
      'src/__tests__/a.test.tsx': [
        "vi.mock('@scope/ui-kit/react', async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io, { Spinner }));",
        "vi.mock('@/hooks/use-thing', async () => (await import('@/test/fakes/with-overrides')).moduleStub({ Button: 1 }));",
      ].join('\n'),
    });
    expect(forbidden).toEqual([]);
  });
});

describe('typedMocks facts', () => {
  it('needs every list, and a why for each forbidden override', () => {
    expect(factProblemsOf(typedMockGuard, {})).toEqual(
      expect.arrayContaining([
        'fakes is missing (declare [] when there is none)',
        'typedHelpers is missing (declare [] when there is none)',
        'forbiddenOverrides is missing (declare [] when there is none)',
      ]),
    );
    expect(
      factProblemsOf(typedMockGuard, {
        ...FACTS,
        forbiddenOverrides: [{ module: 'm', names: ['A'], why: '' }],
      }),
    ).toEqual(["forbiddenOverrides entry m's why is missing"]);
  });
});
