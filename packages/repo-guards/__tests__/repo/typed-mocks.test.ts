import { afterEach, describe, expect, it } from 'vitest';
import { typedMockGuard, type TypedMockFacts } from '../../src/modules/repo/typed-mocks.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';
import { factProblemsOf } from '../helpers/configured.js';

const UI_FAKE = 'src/test/fakes/ui-kit.ts';
const HELPERS = 'src/test/typed-mock.ts';
const THING_STATES = 'src/test/thing-states.ts';

const BASE: Record<string, string> = {
  'src/app/page.tsx': 'export const page = 1;',
  'src/hooks/use-thing.ts': 'export const useThing = () => null;',
  [UI_FAKE]: 'export const uiFake = (io: unknown, overrides = {}) => ({ ...overrides });',
  [HELPERS]:
    'export const passThroughModule = async (io: unknown, o = {}) => o;\n' +
    'export const stubModule = (io: unknown, o: unknown) => o;\nexport const loose = (o: unknown) => o;',
  [THING_STATES]:
    'export const readyThing = () => ({ ready: true });\n' +
    'export const pendingThing = () => ({ ready: false });\nexport const looseThing = () => ({});',
  'functions/src/run.ts': 'export const run = 1;',
};

const FACTS: TypedMockFacts = {
  importAliases: { '@/': 'src/' },
  fakes: [{ module: '@scope/ui-kit/react', owner: UI_FAKE }],
  typedHelpers: [{ owner: HELPERS, names: ['passThroughModule', 'stubModule'] }],
  forbiddenOverrides: [
    {
      module: '@scope/ui-kit/react',
      names: ['Button', 'AccordionContent'],
      why: 'its pending state and its collapsed content are what the cases prove',
    },
  ],
  builtOverrides: [
    {
      module: 'src/hooks/use-thing.ts',
      names: ['useThing'],
      builders: { owner: THING_STATES, names: ['readyThing', 'pendingThing'] },
      why: 'only the builders hold the states the real hook returns',
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
  const [typed, forbidden, built] = typedMockGuard.build(facts);
  const context = contextOf(reader);
  const shape = (f: { file: string; line?: number; detail: string }) => ({
    file: f.file,
    line: f.line,
    detail: f.detail,
  });
  return {
    typed: (await typed.run(context)).map(shape),
    forbidden: (await forbidden.run(context)).map(shape),
    built: (await built.run(context)).map(shape),
  };
}

const TEST = 'src/__tests__/a.test.ts';

interface Expected {
  file: string;
  line: number | undefined;
  detail: RegExp;
}

function expectFindings(
  actual: ReadonlyArray<{ file: string; line: number | undefined; detail: string }>,
  expected: readonly Expected[],
) {
  expect(actual.map(({ file, line }) => ({ file, line }))).toEqual(
    expected.map(({ file, line }) => ({ file, line })),
  );
  actual.forEach((finding, i) => expect(finding.detail).toMatch(expected[i].detail));
}

describe('every module mock is typed against the module it replaces', () => {
  it('passes a mock named through import() that returns through a shared fake or a typed helper, in each form', async () => {
    const { typed } = await findingsOf({
      [TEST]: [
        "vi.mock(import('@scope/ui-kit/react'), async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io));",
        "vi.mock(import('@/hooks/use-thing'), async (importOriginal) =>",
        "  (await import('../test/typed-mock')).passThroughModule(importOriginal, {}));",
        "vi.mock(import('@/hooks/use-thing'), async (importOriginal) => {",
        "  const { stubModule } = await import('@/test/typed-mock');",
        '  return stubModule(importOriginal, { useThing: () => null });',
        '});',
        "vi.doMock(import('@/hooks/use-thing'), async (original) => {",
        "  const helpers = await import('@/test/typed-mock');",
        '  return helpers.stubModule(original, {});',
        '});',
        "vi.mock(import('@/hooks/use-thing'));",
        "vi.mock(import('@/hooks/use-thing'), { spy: true });",
      ].join('\n'),
    });
    expect(typed).toEqual([]);
  });

  it('FLAGS a mock that names its module by a string path, even through a typed helper', async () => {
    const { typed } = await findingsOf({
      [TEST]: [
        "vi.mock('@/hooks/use-thing', async (importOriginal) =>",
        "  (await import('@/test/typed-mock')).passThroughModule(importOriginal, {}));",
        "vi.mock('@/hooks/use-thing', { spy: true });",
      ].join('\n'),
    });
    const detail = /^mocks src\/hooks\/use-thing\.ts by a string path/;
    expectFindings(typed, [
      { file: TEST, line: 1, detail },
      { file: TEST, line: 3, detail },
    ]);
  });

  it('FLAGS a hand-written factory, a spread of the real module, and a helper the facts do not list', async () => {
    const { typed } = await findingsOf({
      [TEST]: [
        "vi.mock(import('@/hooks/use-thing'), () => ({ useThing: () => null }));",
        "vi.mock(import('@scope/ui-kit/react'), async (io) => ({ ...(await io()), toast: vi.fn() }));",
        "vi.mock(import('@/hooks/use-thing'), async () => (await import('@/test/typed-mock')).loose({}));",
      ].join('\n'),
    });
    expect(typed.map(({ file, line }) => ({ file, line }))).toEqual([
      { file: TEST, line: 1 },
      { file: TEST, line: 2 },
      { file: TEST, line: 3 },
    ]);
    expect(typed[0].detail).toMatch(
      /returns something other than a shared fake or a typed mock helper/,
    );
    expect(typed[2].detail).toMatch(/no listed shared fake or typed mock helper/);
  });

  it('FLAGS a helper whose type the test writes, and one handed anything but the factory’s importOriginal', async () => {
    const { typed } = await findingsOf({
      [TEST]: [
        "vi.mock(import('@/hooks/use-thing'), async (importOriginal) =>",
        "  (await import('@/test/typed-mock')).stubModule<typeof import('@/app/page')>(importOriginal, {}));",
        "vi.mock(import('@/hooks/use-thing'), async () =>",
        "  (await import('@/test/typed-mock')).passThroughModule(() => import('@/app/page'), {}));",
        "vi.mock(import('@/hooks/use-thing'), async () =>",
        "  (await import('@/test/typed-mock')).stubModule({}, {}));",
      ].join('\n'),
    });
    expectFindings(typed, [
      {
        file: TEST,
        line: 2,
        detail: /writes the type of its typed mock helper/,
      },
      {
        file: TEST,
        line: 4,
        detail: /something other than the factory's own importOriginal/,
      },
      {
        file: TEST,
        line: 6,
        detail: /something other than the factory's own importOriginal/,
      },
    ]);
  });

  it('FLAGS every return path that is not typed, even when the last one is', async () => {
    const { typed } = await findingsOf({
      [TEST]: [
        "vi.mock(import('@/hooks/use-thing'), async (importOriginal) => {",
        "  const { stubModule } = await import('@/test/typed-mock');",
        '  if (process.env.X) return { useThing: () => 1 };',
        '  return stubModule(importOriginal, {});',
        '});',
        "vi.mock(import('@/hooks/use-thing'), async () => {",
        "  await import('@/test/typed-mock');",
        '});',
      ].join('\n'),
    });
    expectFindings(typed, [
      { file: TEST, line: 3, detail: /returns something other than/ },
      { file: TEST, line: 6, detail: /returns nothing$/ },
    ]);
  });

  it('reads Functions tests too, and never the typed owners themselves', async () => {
    const { typed } = await findingsOf({
      'functions/src/run.test.ts': "vi.mock(import('./run.js'), () => ({ run: 2 }));",
      [UI_FAKE]: "vi.mock('x', () => ({}));\nexport const uiFake = () => ({});",
    });
    expect(typed.map(({ file, line }) => ({ file, line }))).toEqual([
      { file: 'functions/src/run.test.ts', line: 1 },
    ]);
  });

  it('passes a helper an installed package exports by entry, and fails an entry it does not export or a package not installed', async () => {
    const facts: TypedMockFacts = {
      ...FACTS,
      typedHelpers: [
        { owner: '@scope/standards/testing', names: ['passThroughModule'] },
        { owner: '@scope/standards/gone', names: ['passThroughModule'] },
        { owner: '@scope/absent/testing', names: ['passThroughModule'] },
      ],
    };
    const { typed } = await findingsOf(
      {
        'node_modules/@scope/standards/package.json': JSON.stringify({
          name: '@scope/standards',
          exports: { './testing': './dist/testing.js' },
        }),
        [TEST]:
          "vi.mock(import('@/hooks/use-thing'), async (importOriginal) => (await import('@scope/standards/testing')).passThroughModule(importOriginal, {}));",
      },
      facts,
    );
    expect(typed).toEqual([
      {
        file: '@scope/standards/gone',
        line: undefined,
        detail: '@scope/standards exports no ./gone entry for this typed helper',
      },
      {
        file: '@scope/absent/testing',
        line: undefined,
        detail: 'no installed package @scope/absent holds this typed helper entry',
      },
    ]);
  });

  it('fails a typed owner that no longer exists', async () => {
    const { typed } = await findingsOf(
      {},
      { ...FACTS, typedHelpers: [{ owner: 'src/test/gone.ts', names: ['stubModule'] }] },
    );
    expect(typed).toEqual([
      {
        file: 'src/test/gone.ts',
        line: undefined,
        detail: 'this typed fake or helper file no longer exists',
      },
    ]);
  });
});

describe('no test overrides an export whose real behavior every test needs', () => {
  it('FLAGS a listed export overridden through the shared fake or a factory of its own', async () => {
    const { forbidden } = await findingsOf({
      'src/__tests__/a.test.tsx': [
        "vi.mock(import('@scope/ui-kit/react'), async (io) =>",
        "  (await import('@/test/fakes/ui-kit')).uiFake(io, { Button: () => null, Spinner: () => null }));",
        "vi.mock(import('@scope/ui-kit/react'), async (io) => ({ ...(await io()), AccordionContent }));",
      ].join('\n'),
    });
    expectFindings(forbidden, [
      {
        file: 'src/__tests__/a.test.tsx',
        line: 2,
        detail: /^overrides @scope\/ui-kit\/react's Button — the real one runs/,
      },
      {
        file: 'src/__tests__/a.test.tsx',
        line: 3,
        detail: /^overrides @scope\/ui-kit\/react's AccordionContent/,
      },
    ]);
  });

  it('reads only the top level of an override object, so a nested prop of that name passes', async () => {
    const { forbidden } = await findingsOf({
      'src/__tests__/a.test.tsx':
        "vi.mock(import('@scope/ui-kit/react'), async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io, { Dialog: { props: { Button: 1 } } }));",
    });
    expect(forbidden).toEqual([]);
  });

  it('FLAGS an override spread from a variable, a computed name, and an override object it cannot see', async () => {
    const { forbidden } = await findingsOf({
      'src/__tests__/a.test.tsx': [
        "vi.mock(import('@scope/ui-kit/react'), async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io, { ...stand }));",
        "vi.mock(import('@scope/ui-kit/react'), async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io, { [name]: 1 }));",
        "vi.mock(import('@scope/ui-kit/react'), async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io, overrides));",
      ].join('\n'),
    });
    expect(forbidden.map(({ line }) => line)).toEqual([1, 2, 3]);
    expect(forbidden[0].detail).toMatch(
      /^overrides @scope\/ui-kit\/react through names the guard cannot read — .*Button, AccordionContent must stay real/,
    );
  });

  it('passes overrides of exports the facts do not list, a spread of the real module, and other modules', async () => {
    const { forbidden } = await findingsOf({
      'src/__tests__/a.test.tsx': [
        "vi.mock(import('@scope/ui-kit/react'), async (io) => (await import('@/test/fakes/ui-kit')).uiFake(io, { Spinner }));",
        "vi.mock(import('@scope/ui-kit/react'), async (io) => ({ ...(await io()), Spinner }));",
        "vi.mock(import('@/hooks/use-thing'), async (io) => (await import('@/test/typed-mock')).stubModule(io, { Button: 1 }));",
      ].join('\n'),
    });
    expect(forbidden).toEqual([]);
  });

  describe('a shared fake whose state arguments come before its override object', () => {
    const STORE_FAKE = 'src/test/fakes/data-kit.ts';
    const DATA_FACTS: TypedMockFacts = {
      ...FACTS,
      fakes: [...FACTS.fakes, { module: '@scope/data-kit', owner: STORE_FAKE }],
      forbiddenOverrides: [
        {
          module: '@scope/data-kit',
          names: ['onSnapshot', 'getDoc'],
          why: 'reads go through the in-memory store',
          fakeCalls: [{ name: 'dataFake', overridesArgument: 2 }],
        },
      ],
    };
    const fakeFile = {
      [STORE_FAKE]:
        'export const dataFake = (io: unknown, store: unknown, overrides = {}) => ({ ...overrides });',
    };

    it('passes a call that hands the fake only its state, and one whose override object sets no listed name', async () => {
      const { forbidden } = await findingsOf(
        {
          ...fakeFile,
          'src/__tests__/a.test.tsx': [
            "vi.mock(import('@scope/data-kit'), async (io) => (await import('@/test/fakes/data-kit')).dataFake(io, store));",
            "vi.mock(import('@scope/data-kit'), async (io) => (await import('@/test/fakes/data-kit')).dataFake(io, store, { serverTimestamp }));",
          ].join('\n'),
        },
        DATA_FACTS,
      );
      expect(forbidden).toEqual([]);
    });

    it('FLAGS a listed name in the override argument, and an override argument it cannot see', async () => {
      const { forbidden } = await findingsOf(
        {
          ...fakeFile,
          'src/__tests__/a.test.tsx': [
            "vi.mock(import('@scope/data-kit'), async (io) => (await import('@/test/fakes/data-kit')).dataFake(io, store, { onSnapshot }));",
            "vi.mock(import('@scope/data-kit'), async (io) => (await import('@/test/fakes/data-kit')).dataFake(io, store, overrides));",
          ].join('\n'),
        },
        DATA_FACTS,
      );
      expectFindings(forbidden, [
        {
          file: 'src/__tests__/a.test.tsx',
          line: 1,
          detail: /^overrides @scope\/data-kit's onSnapshot — the real one runs/,
        },
        {
          file: 'src/__tests__/a.test.tsx',
          line: 2,
          detail: /^overrides @scope\/data-kit through names the guard cannot read/,
        },
      ]);
    });

    it('still FLAGS a state argument handed to a fake the entry does not name', async () => {
      const { forbidden } = await findingsOf(
        {
          ...fakeFile,
          'src/__tests__/a.test.tsx':
            "vi.mock(import('@scope/data-kit'), async (io) => (await import('@/test/fakes/data-kit')).dataFake(io, store));",
        },
        {
          ...DATA_FACTS,
          forbiddenOverrides: [{ ...DATA_FACTS.forbiddenOverrides[0], fakeCalls: [] }],
        },
      );
      expect(forbidden.map(({ line }) => line)).toEqual([1]);
    });
  });
});

describe('an override of a listed export returns one of its listed builders', () => {
  const MOCK = "vi.mock(import('@/hooks/use-thing'), async (io) =>";
  const HELPER = "  (await import('@/test/typed-mock')).passThroughModule(io, {";

  it('passes a builder call returned directly, through either import, and a holder only builders set', async () => {
    const { built } = await findingsOf({
      [TEST]: [
        "import { pendingThing, readyThing } from '@/test/thing-states';",
        "vi.mock(import('@/hooks/use-thing'), async (io) => {",
        "  const { readyThing: ready } = await import('@/test/thing-states');",
        "  return (await import('@/test/typed-mock')).passThroughModule(io, {",
        '    useThing: (scope: unknown) => {',
        '      scopes.push(scope);',
        '      return ready();',
        '    },',
        '  });',
        '});',
        MOCK,
        HELPER,
        '    useThing: () => holder.state!,',
        '  }),',
        ');',
        'holder.state = readyThing();',
        "it('pending', () => { holder.state = pendingThing(); });",
        MOCK,
        HELPER,
        '    useOther: () => ({}),',
        '  }),',
        ');',
      ].join('\n'),
    });
    expect(built).toEqual([]);
  });

  it('FLAGS a hand-written state, a builder the entry does not list, and a stand-in that is no function', async () => {
    const { built } = await findingsOf({
      [TEST]: [
        "import { looseThing } from '@/test/thing-states';",
        MOCK,
        HELPER,
        '    useThing: () => ({ ready: true }),',
        '  }),',
        ');',
        MOCK,
        HELPER,
        '    useThing: () => looseThing(),',
        '  }),',
        ');',
        MOCK,
        HELPER,
        '    useThing: standIn,',
        '  }),',
        ');',
      ].join('\n'),
    });
    expectFindings(built, [
      {
        file: TEST,
        line: 4,
        detail: /useThing with a value that is no readyThing \/ pendingThing call/,
      },
      {
        file: TEST,
        line: 9,
        detail: /useThing with a value that is no readyThing \/ pendingThing call/,
      },
      {
        file: TEST,
        line: 14,
        detail: /useThing with something other than a function written there/,
      },
    ]);
  });

  it('FLAGS a holder set once to a hand-written state, and a holder nothing sets', async () => {
    const { built } = await findingsOf({
      [TEST]: [
        "import { readyThing } from '@/test/thing-states';",
        MOCK,
        HELPER,
        '    useThing: () => holder.state!,',
        '  }),',
        ');',
        'holder.state = readyThing();',
        "it('drifts', () => { holder.state = { ready: true }; });",
        MOCK,
        HELPER,
        '    useThing: () => other.state!,',
        '  }),',
        ');',
      ].join('\n'),
    });
    expectFindings(built, [
      { file: TEST, line: 8, detail: /useThing through holder\.state, set to a value that is no/ },
      {
        file: TEST,
        line: 11,
        detail: /useThing with other\.state, which nothing in the file sets/,
      },
    ]);
  });

  it('FLAGS an override object it cannot read, since it could hide a listed name', async () => {
    const { built } = await findingsOf({
      [TEST]: [MOCK, HELPER, '    ...overrides,', '  }),', ');'].join('\n'),
    });
    expectFindings(built, [
      {
        file: TEST,
        line: 3,
        detail: /^overrides src\/hooks\/use-thing\.ts through names the guard cannot read/,
      },
    ]);
  });

  it('FLAGS a builders owner that no longer exists', async () => {
    const { built } = await findingsOf(
      {},
      {
        ...FACTS,
        builtOverrides: [
          { ...FACTS.builtOverrides[0], builders: { owner: 'src/test/gone.ts', names: ['x'] } },
        ],
      },
    );
    expectFindings(built, [
      {
        file: 'src/test/gone.ts',
        line: undefined,
        detail: /this typed fake or helper file no longer exists/,
      },
    ]);
  });
});

describe('typedMocks facts', () => {
  it('needs every list, and a why for each forbidden override', () => {
    expect(factProblemsOf(typedMockGuard, {})).toEqual(
      expect.arrayContaining([
        'fakes is missing (declare [] when there is none)',
        'typedHelpers is missing (declare [] when there is none)',
        'forbiddenOverrides is missing (declare [] when there is none)',
        'builtOverrides is missing (declare [] when there is none)',
      ]),
    );
    expect(
      factProblemsOf(typedMockGuard, {
        ...FACTS,
        forbiddenOverrides: [{ module: 'm', names: ['A'], why: '' }],
      }),
    ).toEqual(["forbiddenOverrides entry m's why is missing"]);
  });

  it('needs each built override to name its builders and say why, once per module', () => {
    const entry = FACTS.builtOverrides[0];
    expect(
      factProblemsOf(typedMockGuard, {
        ...FACTS,
        builtOverrides: [
          { ...entry, why: '' },
          { ...entry, why: 'w', builders: { owner: '', names: [] } },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        `builtOverrides entry ${entry.module}'s why is missing`,
        `builtOverrides lists ${entry.module} twice`,
      ]),
    );
    const problems = factProblemsOf(typedMockGuard, {
      ...FACTS,
      builtOverrides: [{ ...entry, builders: { owner: '', names: [] } }],
    });
    expect(problems).toContain(`builtOverrides entry ${entry.module}'s builders owner is missing`);
    expect(
      problems.some(
        (p) =>
          p.startsWith(`builtOverrides entry ${entry.module}'s builders`) && !p.includes('owner'),
      ),
    ).toBe(true);
  });

  it('needs each fake call to name its fake and the position of its override object', () => {
    expect(
      factProblemsOf(typedMockGuard, {
        ...FACTS,
        forbiddenOverrides: [
          {
            module: 'm',
            names: ['A'],
            why: 'w',
            fakeCalls: [
              { name: '', overridesArgument: 2 },
              { name: 'fake', overridesArgument: 0 },
            ],
          },
        ],
      }),
    ).toEqual([
      'a fakeCalls entry of m names no fake',
      'fakeCalls entry fake of m needs overridesArgument, the position of its override object after importOriginal',
    ]);
  });
});
