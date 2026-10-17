// The file-system half: walking an app's test code and writer trees, reading installed packages'
// type declarations, and running the write guard over a tree on disk.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs, { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { createGuardProfile, loadRegistry } from '../src/index.js';
import { collectSourceFiles, collectTestCode, nodePackageDeclarations, runGuard } from '../src/node/index.js';

const MAPS = ['COLLECTIONS', 'COLLECTION_GROUPS', 'USER_PROFILE_SUBCOLLECTIONS', 'SPORT_GAME_SUBCOLLECTIONS', 'WAIVER_TEMPLATE_SUBCOLLECTIONS', 'SPECIAL_DOCS'];

let root;
const write = (rel, text) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), text);
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'firestore-guards-node-'));
  write('src/a.test.ts', 'export {};');
  write('src/__tests__/helpers/seed.ts', 'export {};');
  write('src/lib/source.ts', 'export {};');
  write('functions/src/test/fake-db.ts', 'export {};');
  write('functions/src/users/run.spec.ts', 'export {};');
  write('e2e/helpers/factories.ts', 'export {};');
  write('e2e/node_modules/pkg/index.ts', 'export {};');
  write('node_modules/@scope/media/dist/index.d.ts', 'export declare function build(): { a: number };');
  write('node_modules/@scope/media/dist/lib/deep.d.ts', 'export type T = { b: string };');
  write('node_modules/@scope/media/dist/index.js', 'export function build() { return { a: 1 }; }');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('collectTestCode', () => {
  it('reads every test-named file, every file in a test tree, and a root passed whole', () => {
    const files = collectTestCode(root, [{ root: 'src' }, { root: 'functions/src' }, { root: 'e2e', whole: true }], {
      testTrees: ['functions/src/test'],
    });
    expect(files.map((file) => file.path)).toEqual([
      'e2e/helpers/factories.ts',
      'functions/src/test/fake-db.ts',
      'functions/src/users/run.spec.ts',
      'src/__tests__/helpers/seed.ts',
      'src/a.test.ts',
    ]);
    expect(files[0].content).toBe('export {};');
  });
});

describe('nodePackageDeclarations', () => {
  it("reads every shipped .d.ts of an installed package, and nothing for a package that is not installed", () => {
    const read = nodePackageDeclarations(root);
    expect(read('@scope/media').map((file) => file.text).sort()).toEqual([
      'export declare function build(): { a: number };',
      'export type T = { b: string };',
    ]);
    expect(read('@scope/absent')).toEqual([]);
  });
});

describe('runGuard', () => {
  let registry;
  beforeAll(async () => {
    registry = await loadRegistry({
      sources: { core: () => import('./fixture-core/index.js'), docSchemas: () => import('./fixture-core/doc-schemas.js') },
      constantMapNames: MAPS,
    });
    write(
      'app/writers/profile.ts',
      `import { PATH_BUILDERS, toPath } from '@fixture/core';
       import { buildPublicUser } from '@fixture/core';
       const db = getFirestore();
       export async function writeIt(uid: string) {
         await db.doc(toPath(PATH_BUILDERS.publicUser(uid))).set(buildPublicUser(uid), { merge: true });
       }`,
    );
    write(
      'node_modules/@fixture/core/dist/index.js',
      `export * from './users.js';`,
    );
    write(
      'node_modules/@fixture/core/dist/users.js',
      `export function buildPublicUser(uid) { return { uid, libraryReadUndeclared: true }; }`,
    );
  });

  it("sweeps the writer trees and reads the core's installed code as library code by default", () => {
    const result = runGuard({
      repoRoot: root,
      trees: ['app'],
      registry,
      profile: createGuardProfile({ corePackage: '@fixture/core', coreLibraryRoot: 'node_modules/@fixture/core/dist' }),
      excludePaths: [{ path: 'app/gone', why: 'fixture' }],
    });
    expect(result.fileCount).toBe(1);
    expect(result.writes).toHaveLength(1);
    expect(result.violations.map((violation) => violation.detail).join('\n')).toContain("'libraryReadUndeclared' is not declared by publicUsers/{userId}");
    expect(result.staleExclusions).toEqual(['app/gone']);
  });

  it("cannot read the core's helper with no library root, so the write is unreadable rather than passed", () => {
    const result = runGuard({
      repoRoot: root,
      trees: ['app'],
      registry,
      profile: createGuardProfile({ corePackage: '@fixture/core' }),
    });
    expect(result.violations.map((violation) => violation.kind)).toContain('unreadable-payload');
  });
});

// A directory the guard was told to read that cannot be read is a failure, never an empty folder:
// its writes would go unanalyzed and the guard would still pass. The file system refuses only the
// one directory a test names.
describe('MUST FAIL — a tree the guard must read cannot be read', () => {
  afterEach(() => vi.restoreAllMocks());

  function refuse(relDir) {
    const target = join(root, relDir);
    const real = fs.readdirSync;
    vi.spyOn(fs, 'readdirSync').mockImplementation((dir, ...rest) => {
      if (String(dir) === target) {
        const err = new Error(`EACCES: permission denied, scandir '${dir}'`);
        err.code = 'EACCES';
        throw err;
      }
      return real.call(fs, dir, ...rest);
    });
  }

  beforeAll(() => {
    write('guarded/writers/a.ts', 'export {};');
    write('guarded/writers/nested/b.ts', 'export {};');
    mkdirSync(join(root, 'guarded-empty'), { recursive: true });
  });

  it('a required writer tree that does not exist throws, naming it', () => {
    expect(() => collectSourceFiles(root, 'no-such-tree')).toThrow(`cannot read writer tree ${join(root, 'no-such-tree')}`);
  });

  it('an unreadable directory nested in a writer tree throws, naming it', () => {
    refuse(`guarded${sep}writers${sep}nested`);
    expect(() => collectSourceFiles(root, 'guarded')).toThrow(
      `cannot read writer tree ${join(root, 'guarded', 'writers', 'nested')} (EACCES)`,
    );
  });

  it('runGuard fails on an unreadable nested writer directory instead of passing without it', () => {
    refuse(`guarded${sep}writers${sep}nested`);
    expect(() =>
      runGuard({ repoRoot: root, trees: ['guarded'], registry: {}, profile: createGuardProfile({ corePackage: '@fixture/core' }) }),
    ).toThrow(/cannot read writer tree .*nested/);
  });

  it('an optional writer tree may be absent, but one that exists and cannot be read still throws', () => {
    expect(collectSourceFiles(root, 'no-such-tree', { optional: true })).toEqual([]);
    refuse('guarded');
    expect(() => collectSourceFiles(root, 'guarded', { optional: true })).toThrow(/cannot read writer tree/);
  });

  it('a readable empty tree is valid and holds no files', () => {
    expect(collectSourceFiles(root, 'guarded-empty')).toEqual([]);
  });

  it('a readable tree still lists every source file under it', () => {
    expect(collectSourceFiles(root, 'guarded')).toEqual(['guarded/writers/a.ts', 'guarded/writers/nested/b.ts']);
  });

  it('an unreadable directory in a test-code tree throws, naming it', () => {
    refuse(`src${sep}__tests__`);
    expect(() => collectTestCode(root, [{ root: 'src' }])).toThrow(/cannot read test-code tree .*__tests__/);
  });

  it('an installed package whose folder cannot be read throws, while one not installed declares nothing', () => {
    expect(nodePackageDeclarations(root)('@scope/absent')).toEqual([]);
    refuse(`node_modules${sep}@scope${sep}media${sep}dist${sep}lib`);
    expect(() => nodePackageDeclarations(root)('@scope/media')).toThrow(/cannot read installed package @scope\/media/);
  });
});
