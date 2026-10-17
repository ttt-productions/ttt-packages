// The hand-run duplicate-export report: re-exports are never definitions, genuine duplicates in a
// tree and across the app / Functions boundary report, and a reviewed group stays quiet only while
// its copies stay in its reviewed files.

import { afterEach, describe, expect, it } from 'vitest';
import { analyzeDuplicateExports, duplicateExportsReport, type DuplicateExportFacts } from '../../src/modules/repo/duplicate-exports.js';
import { createRepoReader } from '../../src/reader/reader.js';
import { viewOfText } from '../../src/reader/view.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const NONE: DuplicateExportFacts = { knownLegit: {}, frameworkReservedExports: [] };
const fns = (path: string, text: string) => ({ ...viewOfText(path, text), role: 'functions' as const });
const view = (path: string, text: string) => (path.startsWith('functions/') ? fns(path, text) : viewOfText(path, text));
const analyze = (files: Record<string, string>, facts = NONE) =>
  analyzeDuplicateExports(Object.entries(files).map(([p, t]) => view(p, t)), facts);
const names = (groups: Array<{ name: string; files: string[] }>) => groups.map((g) => `${g.name}: ${g.files.join(', ')}`);

describe('a re-export is never a definition', () => {
  it('counts no star, named, aliased, or two-statement re-export as a second definition', () => {
    const result = analyze({
      'src/lib/real.ts': 'export const a = 1;\nexport type T = string;',
      'src/lib/barrel.ts': [
        "export * from './real';",
        "export { a } from './real';",
        "export { a as b } from './real';",
        "import { a as local } from './real';",
        'export { local };',
        "export type { T } from './real';",
      ].join('\n'),
    });
    expect(names(result.appValues)).toEqual([]);
    expect(names(result.appTypes)).toEqual([]);
  });

  it('counts `export * as ns from` as the new namespace name it binds', () => {
    const result = analyze({ 'src/a.ts': "export * as ns from './x';", 'src/b.ts': 'export const ns = {};' });
    expect(names(result.appValues)).toEqual(['ns: src/a.ts, src/b.ts']);
  });
});

describe('genuine duplicate definitions report', () => {
  it('reports a value and a type defined twice in a tree, and a value defined on both sides', () => {
    const result = analyze({
      'src/a.ts': 'export const shared = 1;\nexport interface Shape { a: 1 }\nexport function both() {}',
      'src/b.ts': 'export const { shared } = obj;\nexport type Shape = { b: 2 };',
      'functions/src/c.ts': 'export const both = () => 1;',
    });
    expect(names(result.appValues)).toEqual(['shared: src/a.ts, src/b.ts']);
    expect(names(result.appTypes)).toEqual(['Shape: src/a.ts, src/b.ts']);
    expect(names(result.crossTree)).toEqual(['both: src/a.ts, functions/src/c.ts']);
  });

  it('skips an unnamed default export and the framework-reserved exports under their path', () => {
    const facts: DuplicateExportFacts = { ...NONE, frameworkReservedExports: [{ pathPrefix: 'src/app/', names: ['GET', 'metadata'], why: 'route contract' }] };
    const result = analyze(
      {
        'src/app/a/route.ts': 'export async function GET() {}\nexport default function () {}',
        'src/app/b/route.ts': 'export async function GET() {}\nexport const metadata = {};\nexport default function () {}',
        'src/lib/x.ts': 'export const metadata = {};',
        'src/lib/y.ts': 'export const metadata = {};',
      },
      facts,
    );
    expect(names(result.appValues)).toEqual(['metadata: src/lib/x.ts, src/lib/y.ts']);
  });
});

describe('reviewed groups', () => {
  const facts: DuplicateExportFacts = { ...NONE, knownLegit: { intake: { files: ['src/a.ts', 'functions/src/a.ts'], why: 'two trust boundaries' } } };

  it('stay quiet while every copy is in a reviewed file, and report the new copy when one appears', () => {
    const quiet = analyze({ 'src/a.ts': 'export const intake = 1;', 'functions/src/a.ts': 'export const intake = 2;' }, facts);
    expect(names(quiet.crossTree)).toEqual([]);
    expect(quiet.suppressed).toBe(1);
    const changed = analyze({ 'src/a.ts': 'export const intake = 1;', 'src/b.ts': 'export const intake = 3;', 'functions/src/a.ts': 'export const intake = 2;' }, facts);
    expect(changed.appValues).toEqual([{ name: 'intake', files: ['src/a.ts', 'src/b.ts'], unexpected: ['src/b.ts'], why: 'two trust boundaries' }]);
  });
});

describe('the report over a repository', () => {
  it('reads the app and Functions roots, skips tests, and prints CLEAN when nothing is left to review', () => {
    repo = tempRepo({
      'src/index.ts': 'export const one = 1;',
      'src/__tests__/x.test.ts': 'export const one = 2;',
      'functions/src/index.ts': 'export const two = 2;',
    });
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: { app: { path: 'src', anchor: 'src/index.ts' }, functions: { path: 'functions/src', anchor: 'functions/src/index.ts' } },
    });
    const { text, result } = duplicateExportsReport(reader, NONE);
    expect(result.modules).toBe(2);
    expect(text).toMatch(/^== app root duplicate value exports: 0 to review ==/);
    expect(text).toMatch(/CLEAN — no unreviewed duplicate exports across 2 modules/);
  });
});
