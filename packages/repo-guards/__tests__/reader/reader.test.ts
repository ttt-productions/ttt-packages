import fs from 'node:fs';
import { join, sep } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRepoReader, layoutProblems } from '../../src/reader/reader.js';
import { kindOfFile, type RepoLayout } from '../../src/reader/layout.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let layout: RepoLayout;

beforeAll(() => {
  repo = tempRepo({
    'src/app/page.tsx': 'export const page = 1;',
    'src/app/page.test.tsx': 'export {};',
    'src/lib/owner.ts': 'export const owner = 1;',
    'src/lib/types.d.ts': 'export type T = 1;',
    'src/__tests__/helpers/seed.ts': 'export {};',
    'src/test/setup.ts': 'export {};',
    'src/lib/fake.test-helper.ts': 'export {};',
    'src/styles/app.css': 'a { color: red; }',
    'src/docs/notes.md': '# notes',
    'src/config/app.json': '{}',
    'src/node_modules/pkg/index.ts': 'export {};',
    'src/dist/out.ts': 'export {};',
    'src/.cache/x.ts': 'export {};',
    'src/generated/out.ts': 'export {};',
    'src/image.png': 'binary',
    'functions/src/index.ts': 'export {};',
    'functions/src/run.spec.ts': 'export {};',
    'e2e/helpers/seed.ts': 'export {};',
    'chat-worker/src/index.ts': 'export {};',
    'firestore.rules': 'rules_version = "2";',
    'node_modules/@scope/kit/dist/index.d.ts': 'export declare const a: 1;',
    'node_modules/@scope/kit/dist/lib/deep.d.ts': 'export type B = 2;',
    'node_modules/@scope/kit/dist/index.js': 'export const a = 1;',
    'node_modules/@scope/kit/node_modules/nested/index.d.ts': 'export {};',
  });
  layout = {
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/lib/owner.ts' },
      functions: { path: 'functions/src', anchor: 'functions/src/index.ts' },
      e2e: { path: 'e2e', anchor: 'e2e/helpers/seed.ts' },
      workers: { 'chat-worker': { path: 'chat-worker', anchor: 'chat-worker/src/index.ts' } },
    },
    rulesFiles: ['firestore.rules'],
    testCodePaths: [{ path: 'src/test', why: 'the frontend suite setup and mocks' }],
    testCodeNameMarkers: [{ marker: '.test-helper.', why: 'a test helper beside the code it serves' }],
    exclusions: [{ path: 'src/generated', why: 'generated output' }],
  };
});

afterAll(() => repo.remove());

const paths = (files: Array<{ path: string }>) => files.map((f) => f.path);

describe('the scope policy', () => {
  it('reads code by kind, leaving out declarations, dependency, build, dot, and excluded folders', () => {
    const reader = createRepoReader(layout);
    expect(paths(reader.files({ roots: ['app'], kinds: ['code'], tests: false }))).toEqual(['src/app/page.tsx', 'src/lib/owner.ts']);
  });

  it('counts a test name, a __tests__ folder, a declared test path, and a declared name marker as test code', () => {
    const reader = createRepoReader(layout);
    expect(paths(reader.files({ roots: ['app'], kinds: ['code'], tests: 'only' }))).toEqual([
      'src/__tests__/helpers/seed.ts',
      'src/app/page.test.tsx',
      'src/lib/fake.test-helper.ts',
      'src/test/setup.ts',
    ]);
  });

  it('reads everything under an end-to-end root as test code', () => {
    const reader = createRepoReader(layout);
    expect(paths(reader.files({ roots: ['e2e'], kinds: ['code'], tests: false }))).toEqual([]);
    expect(paths(reader.files({ roots: ['e2e'], kinds: ['code'], tests: 'only' }))).toEqual(['e2e/helpers/seed.ts']);
  });

  it('reads each kind of file by its name, and never a file of no kind', () => {
    const reader = createRepoReader(layout);
    expect(paths(reader.files({ roots: ['app'], kinds: ['stylesheet', 'markdown', 'config', 'declarations'], tests: true }))).toEqual([
      'src/config/app.json',
      'src/docs/notes.md',
      'src/lib/types.d.ts',
      'src/styles/app.css',
    ]);
  });

  it('reads every Worker tree for the workers role', () => {
    const reader = createRepoReader(layout);
    expect(paths(reader.files({ roots: ['workers'], kinds: ['code'], tests: true }))).toEqual(['chat-worker/src/index.ts']);
  });

  it('throws when a guard asks for a role the layout does not declare, unless the guard reads it only when present', () => {
    const reader = createRepoReader(layout);
    expect(() => reader.files({ roots: ['scripts'], kinds: ['code'], tests: true })).toThrow(/reads the scripts root, which the layout does not declare/);
    expect(reader.files({ roots: ['app', 'scripts'], optionalRoots: ['scripts'], kinds: ['code'], tests: false })).toHaveLength(2);
  });

  it('hands every guard the same view of a file: read, stripped, and parsed once', () => {
    const reader = createRepoReader(layout);
    const [first] = reader.files({ roots: ['app'], kinds: ['code'], tests: false });
    const [again] = reader.files({ roots: ['app'], kinds: ['code'], tests: false });
    expect(again).toBe(first);
    expect(again.sourceFile).toBe(first.sourceFile);
    expect(reader.file('src/app/page.tsx')).toBe(first);
  });

  it('reads one named file, and throws for one that does not exist', () => {
    const reader = createRepoReader(layout);
    expect(reader.file('firestore.rules').kind).toBe('rules');
    expect(() => reader.file('storage.rules')).toThrow(/storage.rules does not exist/);
  });

  it("reads an installed package's shipped files of the asked kinds, its own dependencies left out, under any folder", () => {
    repo.write('functions/node_modules/@scope/server-kit/dist/index.js', 'export const s = 1;');
    const reader = createRepoReader(layout);
    expect(paths(reader.installedFiles('@scope/kit', { kinds: ['declarations'] }))).toEqual([
      'node_modules/@scope/kit/dist/index.d.ts',
      'node_modules/@scope/kit/dist/lib/deep.d.ts',
    ]);
    expect(paths(reader.installedFiles('@scope/kit', { kinds: ['code'] }))).toEqual(['node_modules/@scope/kit/dist/index.js']);
    expect(paths(reader.installedFiles('@scope/server-kit', { kinds: ['code'], under: 'functions' }))).toEqual([
      'functions/node_modules/@scope/server-kit/dist/index.js',
    ]);
    expect(reader.installedFiles('@scope/server-kit', { kinds: ['code'] })).toEqual([]);
    expect(reader.installedFiles('@scope/absent', { kinds: ['code'] })).toEqual([]);
  });

  it('reads a file outside the checkout by absolute path, and answers null for an absent one', () => {
    const reader = createRepoReader(layout);
    expect(reader.readOutside(join(repo.root, 'firestore.rules'))).toContain('rules_version');
    expect(reader.readOutside(join(repo.root, 'no-such-file.md'))).toBeNull();
    expect(() => reader.readOutside('relative/path.md')).toThrow(/not an absolute path/);
  });

  it('knows env files by any name, and shell scripts', () => {
    for (const name of ['.env', '.env.local', 'temp.env.dev', 'app.env']) expect(kindOfFile(name)).toBe('config');
    for (const name of ['deploy.sh', 'setup.ps1']) expect(kindOfFile(name)).toBe('shell');
    for (const [name, kind] of [['env.ts', 'code'], ['environment.json', 'config'], ['README.md', 'markdown']] as const) {
      expect(kindOfFile(name)).toBe(kind);
    }
    expect(kindOfFile('LICENSE')).toBeNull();
  });

  it('reaches every root anchor in a whole walk', () => {
    expect(createRepoReader(layout).unreachedAnchors()).toEqual([]);
  });
});

describe('MUST FAIL — a layout that cannot be read whole', () => {
  it('lists a missing root, a missing or misplaced anchor, a stale exclusion, a reviewed entry with no why, and a missing rules file', () => {
    const problems = layoutProblems({
      ...layout,
      roots: {
        app: { path: 'src', anchor: 'functions/src/index.ts' },
        functions: { path: 'functions/src', anchor: 'functions/src/gone.ts' },
        scripts: { path: 'scripts', anchor: 'scripts/run.mjs' },
      },
      rulesFiles: ['storage.rules'],
      exclusions: [
        { path: 'src/gone', why: 'stale' },
        { path: 'src/generated', why: ' ' },
      ],
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        "root app's anchor functions/src/index.ts is not under src",
        "root functions's anchor functions/src/gone.ts does not exist",
        'root scripts (scripts) does not exist',
        'rules file storage.rules does not exist',
        'exclusion src/gone no longer exists',
        'exclusion src/generated carries no why',
      ]),
    );
  });

  it('refuses an anchor that an exclusion hides', () => {
    expect(layoutProblems({ ...layout, exclusions: [{ path: 'src/lib', why: 'hides the anchor' }] })).toContain(
      'anchor src/lib/owner.ts is excluded by src/lib',
    );
  });

  it('refuses to build a reader over a layout with any problem', () => {
    expect(() => createRepoReader({ ...layout, exclusions: [{ path: 'src/gone', why: 'stale' }] })).toThrow(/exclusion src\/gone no longer exists/);
  });
});

// A folder the reader cannot read fails the run naming it, never reads as an empty folder: its
// files would go unchecked and every guard would still pass.
describe('MUST FAIL — a folder that cannot be read', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws naming the nested folder', () => {
    const target = join(repo.root, `src${sep}lib`);
    const real = fs.readdirSync;
    vi.spyOn(fs, 'readdirSync').mockImplementation(((dir: fs.PathLike, ...rest: unknown[]) => {
      if (String(dir) === target) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      return (real as (...a: unknown[]) => unknown).call(fs, dir, ...rest);
    }) as typeof fs.readdirSync);
    const reader = createRepoReader(layout);
    expect(() => reader.files({ roots: ['app'], kinds: ['code'], tests: false })).toThrow('cannot read folder src/lib (EACCES)');
  });
});

describe('comments never reach a guard', () => {
  it('blanks code comments and keeps strings, templates, regular expressions, and JSX text, with every line where it was', () => {
    repo.write(
      'src/app/comments.tsx',
      [
        "const url = 'https://example.test'; // trailing",
        '/* block',
        '   still block */ const re = /\\/\\/not-a-comment/;',
        'const t = `// in a template`;',
        'const el = <p>// jsx text {/* jsx comment */}</p>;',
        '/** doc comment */',
        'export const last = 1; // end of file',
      ].join('\n'),
    );
    const view = createRepoReader(layout).file('src/app/comments.tsx');
    expect(view.code).not.toContain('trailing');
    expect(view.code).not.toContain('block');
    expect(view.code).not.toContain('jsx comment');
    expect(view.code).not.toContain('doc comment');
    expect(view.code).not.toContain('end of file');
    expect(view.code).toContain("'https://example.test'");
    expect(view.code).toContain('/\\/\\/not-a-comment/');
    expect(view.code).toContain('`// in a template`');
    expect(view.code).toContain('<p>// jsx text');
    expect(view.code.length).toBe(view.text.length);
    expect(view.lineOf(view.code.indexOf('const t'))).toBe(4);
  });

  it('blanks rules-file comments and keeps quoted text and request paths', () => {
    repo.write(
      'firestore.rules',
      [
        "match /users/{uid} { // admins read the live roster",
        '  /* a block',
        "     comment */ allow read: if request.auth.token.get('role', '//not-a-comment') == 'admin';",
        '  allow write: if get(/databases/$(database)/documents/_systemData/adminList).data.size() > 0;',
        '}',
      ].join('\n'),
    );
    const view = createRepoReader(layout).file('firestore.rules');
    expect(view.code).not.toContain('live roster');
    expect(view.code).not.toContain('a block');
    expect(view.code).toContain("'//not-a-comment'");
    expect(view.code).toContain('/databases/$(database)/documents/_systemData/adminList');
    expect(view.code.length).toBe(view.text.length);
    expect(view.lineOf(view.code.indexOf('allow write'))).toBe(4);
  });

  it('blanks stylesheet comments and keeps quoted text', () => {
    repo.write('src/styles/commented.css', "a { color: red; /* hsl(0 0% 0%) */ content: '/* kept */'; }");
    const view = createRepoReader(layout).file('src/styles/commented.css');
    expect(view.code).not.toContain('hsl(');
    expect(view.code).toContain("'/* kept */'");
  });
});
