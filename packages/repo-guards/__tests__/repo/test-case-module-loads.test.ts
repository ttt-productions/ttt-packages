import { afterEach, describe, expect, it } from 'vitest';
import {
  testCaseModuleLoadGuard,
  testCaseModuleLoads,
} from '../../src/modules/repo/test-case-module-loads.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const ALIASES = ['@/'];
const loadsIn = (source: string) => testCaseModuleLoads(source, ALIASES).map((l) => l.detail);

describe('which loads land inside a test case', () => {
  it('flags a dynamic import of local code in a case, a hook, or a helper a case calls', () => {
    expect(loadsIn("it('x', async () => { await import('./thing.js'); });")).toHaveLength(1);
    expect(loadsIn("beforeEach(async () => { await import('../thing.js'); });")).toHaveLength(1);
    expect(
      loadsIn("async function load() { return import('@/hooks/thing'); }\nit('x', load);"),
    ).toHaveLength(1);
  });

  it('flags a module-registry reset wherever it is called', () => {
    expect(loadsIn('afterEach(() => { vi.resetModules(); });')).toEqual([
      'vi.resetModules() reloads every module for the cases after it',
    ]);
    expect(loadsIn('vi.resetModules();')).toHaveLength(1);
  });

  it('flags a function inside a mock factory, which runs when a case calls it', () => {
    expect(
      loadsIn("vi.mock('./a.js', () => ({ later: async () => import('./b.js') }));"),
    ).toHaveLength(1);
  });

  it('passes a load that happens while the file is collected', () => {
    expect(loadsIn("const mod = await import('./thing.js');")).toEqual([]);
    expect(loadsIn("const m = vi.hoisted(async () => await import('./thing.js'));")).toEqual([]);
    expect(
      loadsIn("vi.mock('./a.js', async () => ({ ...(await import('./a-real.js')) }));"),
    ).toEqual([]);
  });

  it("passes a package import, a mock helper, and a type position — none loads the app's code", () => {
    expect(loadsIn("it('x', async () => { await import('zod'); });")).toEqual([]);
    expect(loadsIn("it('x', async () => { await import('@scope/pkg'); });")).toEqual([]);
    expect(loadsIn("it('x', async () => { await vi.importActual('./thing.js'); });")).toEqual([]);
    expect(
      loadsIn(
        "vi.mock('./a.js', async (orig) => ({ ...(await orig<typeof import('./a.js')>()) }));",
      ),
    ).toEqual([]);
  });

  it('reads an alias as local only when the app declares it', () => {
    const source = "it('x', async () => { await import('@/hooks/thing'); });";
    expect(testCaseModuleLoads(source, [])).toEqual([]);
    expect(testCaseModuleLoads(source, ['@/'])).toHaveLength(1);
  });

  it('never reads a mention in a comment or a string', () => {
    expect(
      loadsIn("// vi.resetModules();\nit('x', () => { const s = \"import('./a.js')\"; });"),
    ).toEqual([]);
  });
});

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

async function findingsOf(
  files: Record<string, string>,
  reviewed: Array<{ path: string; why: string }> = [],
) {
  repo = tempRepo({ 'src/index.ts': 'export {};', ...files });
  const [guard] = testCaseModuleLoadGuard.build({ localAliases: ALIASES, reviewed });
  const findings = (await guard.run(
    contextOf(
      createRepoReader({
        repoRoot: repo.root,
        roots: { app: { path: 'src', anchor: 'src/index.ts' } },
      }),
    ) as never,
  )) as Array<{ file: string; line?: number; detail: string }>;
  return findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);
}

describe('a test loads the code it tests when its file loads', () => {
  it('passes a test file that imports what it tests at the top', async () => {
    expect(
      await findingsOf({
        'src/thing.test.ts': "import { thing } from './thing.js';\nit('x', () => thing());",
      }),
    ).toEqual([]);
  });

  it('finds each load inside a case, by file and line', async () => {
    expect(
      await findingsOf({
        'src/thing.test.ts':
          "import { it } from 'vitest';\nit('x', async () => {\n  const { thing } = await import('./thing.js');\n});",
      }),
    ).toEqual(["src/thing.test.ts:3 import('./thing.js') loads the module inside a test case"]);
  });

  it('never reads source that is not test code', async () => {
    expect(
      await findingsOf({ 'src/lazy.ts': "export const load = () => import('./heavy.js');" }),
    ).toEqual([]);
  });

  it('passes a reviewed file, and fails a reviewed entry whose file no longer loads inside a case', async () => {
    const files = {
      'src/env.test.ts': "it('x', async () => { vi.resetModules(); await import('./env.js'); });",
      'src/clean.test.ts': "import { a } from './a.js';\nit('x', () => a());",
    };
    expect(
      await findingsOf(files, [{ path: 'src/env.test.ts', why: 'reads its env once at load' }]),
    ).toEqual([]);
    expect(
      await findingsOf(files, [
        { path: 'src/env.test.ts', why: 'reads its env once at load' },
        { path: 'src/clean.test.ts', why: 'no longer true' },
      ]),
    ).toEqual([
      'src/clean.test.ts stale reviewed entry: the file no longer loads a module inside a test case',
    ]);
  });
});

describe('the facts the guard takes', () => {
  it('requires the aliases list and reviewed entries that each carry a why', () => {
    expect(testCaseModuleLoadGuard.factProblems({ localAliases: [], reviewed: [] })).toEqual([]);
    expect(testCaseModuleLoadGuard.factProblems({} as never)).toEqual([
      'localAliases is missing (declare [] when there is none)',
      'reviewed is missing (declare [] when there is none)',
    ]);
    expect(
      testCaseModuleLoadGuard.factProblems({
        localAliases: ['@/'],
        reviewed: [{ path: 'src/a.test.ts', why: '' }],
      }),
    ).toEqual(['reviewed entry src/a.test.ts carries no why']);
  });
});
