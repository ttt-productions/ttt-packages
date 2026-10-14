// The file-system half: walking an app's test code and writer trees, reading installed packages'
// type declarations, and running the write guard over a tree on disk.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGuardProfile, loadRegistry } from '../src/index.js';
import { collectTestCode, nodePackageDeclarations, runGuard } from '../src/node/index.js';

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
