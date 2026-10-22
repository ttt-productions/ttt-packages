import { afterAll, describe, expect, it } from 'vitest';
import {
  packageEntriesGuard,
  packageEntryImportsGuard,
} from '../../src/modules/import-paths/package-entries.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const repos: TempRepo[] = [];
afterAll(() => repos.forEach((r) => r.remove()));

const exportsOf = (entries: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(entries).map(([key, dist]) => [
      key,
      { types: `./dist/${dist}.d.ts`, default: `./dist/${dist}.js` },
    ]),
  );

const manifest = (entries: Record<string, string>) =>
  JSON.stringify({ name: '@acme/kit', type: 'module', exports: exportsOf(entries) });

const ENTRIES = {
  '.': 'index',
  './schemas': 'schemas/index',
  './react': 'react/index',
  './browser': 'browser',
};

function packageRepo(src: Record<string, string>, entries: Record<string, string> = ENTRIES) {
  const files: Record<string, string> = {
    'scripts/anchor.ts': 'export {};',
    'packages/kit/package.json': manifest(entries),
  };
  for (const [path, text] of Object.entries(src)) files[`packages/kit/src/${path}`] = text;
  const repo = tempRepo(files);
  repos.push(repo);
  return createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: '.', anchor: 'scripts/anchor.ts' } },
  });
}

const CLEAN_SOURCE = {
  'index.ts': "export { version } from './version.js';",
  'version.ts': 'export const version = 1;',
  'schemas/index.ts': "export { UserSchema, type User } from './user.js';",
  'schemas/user.ts': 'export const UserSchema = 1;\nexport type User = { id: string };',
  'react/index.ts': "export { Button } from './button.js';",
  'react/button.ts': 'export const Button = 1;',
  'browser.ts': 'export const startUpload = 1;',
};

const runPackageCheck = async (src: Record<string, string>, entries?: Record<string, string>) => {
  const [guard] = packageEntriesGuard.build({ packagesFolder: 'packages' });
  const findings = await guard.run(contextOf(packageRepo(src, entries)));
  return findings.map((f) => `${f.file} — ${f.detail}`);
};

describe("a package's own entries", () => {
  it('pass when each definition is exported by its folder entry alone, a root-level file entry included', async () => {
    expect(await runPackageCheck(CLEAN_SOURCE)).toEqual([]);
  });

  it('FLAG a definition the root also forwards from a folder that has its own entry', async () => {
    const src = {
      ...CLEAN_SOURCE,
      'index.ts': "export { version } from './version.js';\nexport * from './schemas/index.js';",
    };
    expect(await runPackageCheck(src)).toEqual([
      "packages/kit/src/schemas/user.ts — User is exported by '@acme/kit', '@acme/kit/schemas'; only its folder's entry '@acme/kit/schemas' exports it",
      "packages/kit/src/schemas/user.ts — UserSchema is exported by '@acme/kit', '@acme/kit/schemas'; only its folder's entry '@acme/kit/schemas' exports it",
    ]);
  });

  it('FLAG a definition only the root exports though its folder has an entry', async () => {
    const src = {
      ...CLEAN_SOURCE,
      'index.ts':
        "export { version } from './version.js';\nexport { Extra } from './schemas/extra.js';",
      'schemas/extra.ts': 'export const Extra = 1;',
    };
    expect(await runPackageCheck(src)).toEqual([
      "packages/kit/src/schemas/extra.ts — Extra is exported by '@acme/kit'; only its folder's entry '@acme/kit/schemas' exports it",
    ]);
  });

  it('FLAG a file-level entry for a file a folder entry covers', async () => {
    const entries = { ...ENTRIES, './schemas/user': 'schemas/user' };
    expect(await runPackageCheck(CLEAN_SOURCE, entries)).toEqual([
      "packages/kit/src/schemas/user.ts — User is exported by '@acme/kit/schemas', '@acme/kit/schemas/user'; only its folder's entry '@acme/kit/schemas' exports it",
      "packages/kit/src/schemas/user.ts — UserSchema is exported by '@acme/kit/schemas', '@acme/kit/schemas/user'; only its folder's entry '@acme/kit/schemas' exports it",
    ]);
  });

  it('read an entry built from a JavaScript source module', async () => {
    const entries = { ...ENTRIES, './seed': 'seed/index' };
    expect(
      await runPackageCheck(
        { ...CLEAN_SOURCE, 'seed/index.js': 'export const seed = 1;' },
        entries,
      ),
    ).toEqual([]);
  });

  it('FLAG an entry whose source module is missing', async () => {
    const src = { ...CLEAN_SOURCE };
    delete (src as Record<string, string>)['browser.ts'];
    expect(await runPackageCheck(src)).toEqual([
      'packages/kit/package.json — entry ./browser: no source module builds ./dist/browser.d.ts',
    ]);
  });

  it('refuses facts with no packages folder', () => {
    expect(packageEntriesGuard.factProblems({ packagesFolder: '' })).toEqual([
      'packagesFolder is missing',
    ]);
  });
});

function consumerRepo(app: Record<string, string>) {
  const files: Record<string, string> = {
    'node_modules/@acme/kit/package.json': manifest(ENTRIES),
    'node_modules/@acme/kit/dist/index.d.ts': "export { version } from './version.js';",
    'node_modules/@acme/kit/dist/version.d.ts': 'export declare const version = 1;',
    'node_modules/@acme/kit/dist/schemas/index.d.ts':
      "export { UserSchema, type User } from './user.js';",
    'node_modules/@acme/kit/dist/schemas/user.d.ts':
      'export declare const UserSchema = 1;\nexport type User = { id: string };',
    'node_modules/@acme/kit/dist/react/index.d.ts':
      "export { Button } from './button.js';\nexport { UserSchema } from '../schemas/user.js';",
    'node_modules/@acme/kit/dist/react/button.d.ts': 'export declare const Button = 1;',
    'node_modules/@acme/kit/dist/browser.d.ts': 'export declare const startUpload = 1;',
  };
  for (const [path, text] of Object.entries(app)) files[`src/${path}`] = text;
  const repo = tempRepo(files);
  repos.push(repo);
  return createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/page.ts' } },
  });
}

const runConsumerCheck = async (app: Record<string, string>) => {
  const [guard] = packageEntryImportsGuard.build({ scope: '@acme' });
  const findings = await guard.run(contextOf(consumerRepo(app)));
  return findings.map((f) => `${f.file}:${f.line} — ${f.detail}`);
};

describe("a consumer's imports of a package", () => {
  it('pass when each name comes from the entry that owns it, type-only imports and re-exports included', async () => {
    expect(
      await runConsumerCheck({
        'page.ts': [
          "import { version } from '@acme/kit';",
          "import { UserSchema, type User } from '@acme/kit/schemas';",
          "import { Button } from '@acme/kit/react';",
          "export { startUpload } from '@acme/kit/browser';",
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('FLAG a name imported from an entry that carries it but does not own it, naming the owner', async () => {
    expect(
      await runConsumerCheck({
        'page.ts':
          "import { Button, UserSchema } from '@acme/kit/react';\nimport type { User } from '@acme/kit/schemas';",
      }),
    ).toEqual([
      "src/page.ts:1 — imports UserSchema from '@acme/kit/react', but its entry is '@acme/kit/schemas'",
    ]);
  });

  it('reads test files too, and leaves a module mock alone', async () => {
    expect(
      await runConsumerCheck({
        'page.ts': "import { version } from '@acme/kit';",
        '__tests__/page.test.ts':
          "import { UserSchema } from '@acme/kit/react';\nvi.mock('@acme/kit/react');",
      }),
    ).toEqual([
      "src/__tests__/page.test.ts:1 — imports UserSchema from '@acme/kit/react', but its entry is '@acme/kit/schemas'",
    ]);
  });

  it('refuses a scope that is not an npm scope', () => {
    expect(packageEntryImportsGuard.factProblems({ scope: 'acme' })).toEqual([
      'scope must be an npm scope such as @acme',
    ]);
  });
});
