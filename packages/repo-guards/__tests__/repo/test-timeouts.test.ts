import { afterEach, describe, expect, it } from 'vitest';
import {
  limitSites,
  slowTestReport,
  testTimeoutGuard,
  type TestTimeoutFacts,
} from '../../src/modules/repo/test-timeouts.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';
import { factProblemsOf } from '../helpers/configured.js';

const what = (source: string) => limitSites(source).map((s) => s.what);

describe('where a test sets a time limit', () => {
  it('finds a test, suite, and hook limit, written as an argument or an option', () => {
    expect(what("it('x', async () => {}, 5000);")).toEqual(['the it timeout']);
    expect(what("test.skipIf(a)('x', { timeout: 9000 }, () => {});")).toEqual([
      'the test option timeout',
    ]);
    expect(what("describe('x', { timeout: 9000 }, () => {});")).toEqual([
      'the describe option timeout',
    ]);
    expect(what("it.each([1])('x %i', (n) => {}, 9000);")).toEqual(['the it timeout']);
    expect(what('beforeAll(async () => {}, 20_000);')).toEqual(['the beforeAll timeout']);
  });

  it('finds the runner config, a library wait, and the library default', () => {
    expect(what('vi.setConfig({ testTimeout: 9000, hookTimeout: 9000 });')).toEqual([
      'the config testTimeout',
      'the config hookTimeout',
    ]);
    expect(what('await waitFor(() => check(), { timeout: 2000 });')).toEqual([
      'the waitFor wait timeout',
    ]);
    expect(what("await screen.findByText('x', {}, { timeout: 3000 });")).toEqual([
      'the findByText wait timeout',
    ]);
    expect(what('configure({ asyncUtilTimeout: 4000 });')).toEqual([
      'the test library asyncUtilTimeout',
    ]);
  });

  it('reads the object a same-file constant holds', () => {
    expect(what('const WAIT = { timeout: 5000 };\nawait waitFor(() => check(), WAIT);')).toEqual([
      'the waitFor wait timeout',
    ]);
  });

  it('finds nothing in a test with no limit, a timer, or a timeout handed to the code under test', () => {
    expect(what("it('x', () => { expect(1).toBe(1); });")).toEqual([]);
    expect(
      what("setTimeout(done, 1000);\nawait page.waitForURL('/x', { timeout: 30_000 });"),
    ).toEqual([]);
    expect(what("expect(calls.goto).toEqual(['/x', { timeout: 5_000 }]);")).toEqual([]);
  });
});

const BUDGETS = 'src/test/timeouts.ts';
const FACTS: TestTimeoutFacts = { importAliases: { '@/': 'src/' }, timeoutFiles: [BUDGETS] };

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

function readerOf(files: Record<string, string>): RepoReader {
  repo = tempRepo({
    'src/app/page.tsx': 'export const page = 1;',
    [BUDGETS]: 'export const SLOW_TEST_TIMEOUT_MS = 15_000;',
    ...files,
  });
  return createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/app/page.tsx' } },
    testCodePaths: [{ path: 'src/test', why: 'the shared test budgets and helpers' }],
  });
}

async function findingsOf(files: Record<string, string>, facts: TestTimeoutFacts = FACTS) {
  const [guard] = testTimeoutGuard.build(facts);
  return (await guard.run(contextOf(readerOf(files)))).map((f) => `${f.file} ${f.detail}`);
}

describe('a limit names a budget from a timeout file', () => {
  it('passes a budget imported from the timeout file, by alias or relative path, and a test with no limit', async () => {
    expect(
      await findingsOf({
        'src/__tests__/a.test.ts':
          "import { SLOW_TEST_TIMEOUT_MS } from '@/test/timeouts';\nit('x', async () => {}, SLOW_TEST_TIMEOUT_MS);",
        'src/__tests__/b.test.ts': [
          "import { SLOW_TEST_TIMEOUT_MS as SLOW } from '../test/timeouts.ts';",
          "describe('x', { timeout: SLOW }, () => { it('y', async () => { await waitFor(() => 1, { timeout: SLOW }); }); });",
        ].join('\n'),
        'src/__tests__/c.test.ts': "it('x', () => {});",
      }),
    ).toEqual([]);
  });

  it('FLAGS a number, a local constant, and a budget name imported from somewhere else', async () => {
    expect(
      await findingsOf({
        'src/__tests__/a.test.ts': "it('x', async () => {}, 20_000);",
        'src/__tests__/b.test.ts': "const LONG = 30_000;\nit('x', async () => {}, LONG);",
        'src/__tests__/c.test.ts':
          "import { SLOW_TEST_TIMEOUT_MS } from './elsewhere';\nawait waitFor(() => 1, { timeout: SLOW_TEST_TIMEOUT_MS });",
      }),
    ).toEqual([
      'src/__tests__/a.test.ts the it timeout is written as a number — leave the default, or name a budget from a timeout file',
      'src/__tests__/b.test.ts the it timeout is LONG, which is no budget imported from a timeout file — name one of its constants',
      'src/__tests__/c.test.ts the waitFor wait timeout is SLOW_TEST_TIMEOUT_MS, which is no budget imported from a timeout file — name one of its constants',
    ]);
  });

  it('FLAGS a timeout file that is gone, is not test code, or exports no budget', async () => {
    expect(
      await findingsOf(
        {
          'src/lib/budgets.ts': 'export const X = 1;',
          'src/test/empty.ts': "export const NAME = 'x';",
        },
        { ...FACTS, timeoutFiles: ['src/test/gone.ts', 'src/lib/budgets.ts', 'src/test/empty.ts'] },
      ),
    ).toEqual([
      'src/test/gone.ts the timeout file src/test/gone.ts no longer exists',
      'src/lib/budgets.ts the timeout file src/lib/budgets.ts is not test code — the budgets live with the tests',
      'src/test/empty.ts the timeout file src/test/empty.ts exports no numeric const budget',
    ]);
  });

  it('refuses a missing timeoutFiles list and accepts an app that declares none yet', () => {
    expect(factProblemsOf(testTimeoutGuard, { importAliases: {} })).toEqual([
      'timeoutFiles is missing (declare [] when there is none)',
    ]);
    expect(testTimeoutGuard.factProblems({ importAliases: {}, timeoutFiles: [] })).toEqual([]);
  });
});

describe('the slow-test report', () => {
  it('lists cases at or over the threshold whose file names no budget, slowest first', () => {
    const reader = readerOf({
      'src/__tests__/slow.test.ts': "it('heavy', () => {});",
      'src/__tests__/marked.test.ts':
        "import { SLOW_TEST_TIMEOUT_MS } from '@/test/timeouts';\nit('heavy', () => {}, SLOW_TEST_TIMEOUT_MS);",
    });
    const root = repo!.root.replace(/\\/g, '/');
    const results = [
      {
        testResults: [
          {
            name: `${root}/src/__tests__/slow.test.ts`,
            assertionResults: [
              { fullName: 'heavy', duration: 3200 },
              { fullName: 'quick', duration: 40 },
            ],
          },
          {
            name: `${root}/src/__tests__/marked.test.ts`,
            assertionResults: [{ fullName: 'heavy', duration: 4100 }],
          },
          {
            name: `${root}/src/__tests__/slow.test.ts`,
            assertionResults: [{ fullName: 'edge', duration: 1000 }],
          },
        ],
      },
    ];
    expect(slowTestReport(reader, FACTS, results, 1000)).toEqual([
      { file: 'src/__tests__/slow.test.ts', name: 'heavy', durationMs: 3200 },
      { file: 'src/__tests__/slow.test.ts', name: 'edge', durationMs: 1000 },
    ]);
  });
});
