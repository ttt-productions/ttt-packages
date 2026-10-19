// The Firestore guards read through the one reader: the write guard sweeps the writer roots and
// reads the core's installed build as library code; the test-path guard reads only test code.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GuardContext } from '../../src/guard.js';
import { contextOf } from '../helpers/context.js';
import {
  runWriteGuard,
  testPathGuard,
  writeGuard,
  type WriteGuardFacts,
} from '../../src/modules/firestore/guard.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import type { RepoLayout } from '../../src/node/layout.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const MAPS = [
  'COLLECTIONS',
  'COLLECTION_GROUPS',
  'USER_PROFILE_SUBCOLLECTIONS',
  'SPORT_GAME_SUBCOLLECTIONS',
  'WAIVER_TEMPLATE_SUBCOLLECTIONS',
  'SPECIAL_DOCS',
];

let repo: TempRepo;
let layout: RepoLayout;
let reader: RepoReader;

beforeAll(() => {
  repo = tempRepo({
    'app/writers/profile.ts': `import { PATH_BUILDERS, toPath } from '@fixture/core';
       import { buildPublicUser } from '@fixture/core';
       const db = getFirestore();
       export async function writeIt(uid: string) {
         await db.doc(toPath(PATH_BUILDERS.publicUser(uid))).set(buildPublicUser(uid), { merge: true });
       }`,
    'app/writers/profile.test.ts': "const ref = doc(db, 'publicUsers', uid);",
    'app/__tests__/rules/setup.ts': 'const key = `publicUsers/${uid}`;',
    'node_modules/@fixture/core/dist/index.js': "export * from './users.js';",
    'node_modules/@fixture/core/dist/users.js':
      'export function buildPublicUser(uid) { return { uid, libraryReadUndeclared: true }; }',
  });
  layout = {
    repoRoot: repo.root,
    roots: {
      app: { path: 'app', anchor: 'app/writers/profile.ts' },
      coreDist: {
        path: 'node_modules/@fixture/core/dist',
        anchor: 'node_modules/@fixture/core/dist/index.js',
      },
    },
  };
  reader = createRepoReader(layout);
});
afterAll(() => repo.remove());

const context = (): GuardContext => contextOf(reader);

const facts = (overrides: Partial<WriteGuardFacts> = {}): WriteGuardFacts => ({
  corePackage: '@fixture/core',
  importAliases: {},
  transactionTypeNames: [],
  handleModulePrefixes: [],
  removalOnlyTables: [],
  registrySources: {
    core: () => import('./fixture-core/index.js'),
    docSchemas: () => import('./fixture-core/doc-schemas.js'),
  },
  constantMapNames: MAPS,
  writerRoots: ['app'],
  writerAnchors: ['app/writers/profile.ts'],
  exceptions: [],
  ...overrides,
});

describe('the write guard over the reader', () => {
  it("sweeps the writer roots, leaves test code out, and reads the core's installed build as library code", async () => {
    const result = await runWriteGuard(reader, facts());
    expect(result.fileCount).toBe(1);
    expect(result.writes).toHaveLength(1);
    expect(result.violations.map((v: { detail: string }) => v.detail).join('\n')).toContain(
      "'libraryReadUndeclared' is not declared by publicUsers/{userId}",
    );
  });

  it('FLAGS a stored field its schema does not declare', async () => {
    const [guard] = writeGuard.build(facts());
    const findings = await guard.run(context());
    expect(
      findings.some(
        (f) =>
          f.file.startsWith('app/writers/profile.ts:') &&
          f.detail.includes('libraryReadUndeclared'),
      ),
    ).toBe(true);
  });

  it('FLAGS a writer anchor the guard sees no write in', async () => {
    const [guard] = writeGuard.build(facts({ writerAnchors: ['app/writers/profile.test.ts'] }));
    const findings = await guard.run(context());
    expect(findings).toContainEqual({
      file: 'app/writers/profile.test.ts',
      detail: 'writer anchor: no write seen in it',
    });
  });

  it('FLAGS a reviewed exception that matches nothing', async () => {
    const [guard] = writeGuard.build(
      facts({
        exceptions: [
          {
            kind: 'undeclared-field',
            file: 'app/writers/gone.ts',
            fn: 'gone',
            marker: 'x',
            field: 'y',
            why: 'stale',
          },
        ],
      }),
    );
    const findings = await guard.run(context());
    expect(
      findings.some(
        (f) =>
          f.file === '(exceptions)' &&
          f.detail.startsWith('stale exception: undeclared-field app/writers/gone.ts'),
      ),
    ).toBe(true);
  });

  it('refuses to run without the core build root: a helper it cannot read would pass unread', async () => {
    const noCore = createRepoReader({ ...layout, roots: { app: layout.roots.app } });
    await expect(runWriteGuard(noCore, facts())).rejects.toThrow(/declares no coreDist root/);
  });
});

describe('the test-code path guard over the reader', () => {
  it('FLAGS a hand-typed path in test code (a test file and a file in a __tests__ folder), never in source', async () => {
    const [guard] = testPathGuard.build({ collectionNames: () => ['publicUsers'] });
    const findings = await guard.run(context());
    expect(findings.map((f) => `${f.file}:${f.line}`)).toEqual([
      'app/__tests__/rules/setup.ts:1',
      'app/writers/profile.test.ts:1',
    ]);
  });
});
