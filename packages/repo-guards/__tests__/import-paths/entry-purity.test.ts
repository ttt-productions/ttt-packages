import { afterAll, describe, expect, it } from 'vitest';
import {
  entryPurityGuard,
  type EntryPurityFacts,
} from '../../src/modules/import-paths/entry-purity.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';
import { factProblemsOf } from '../helpers/configured.js';

const repos: TempRepo[] = [];
afterAll(() => repos.forEach((r) => r.remove()));

const FACTS: EntryPurityFacts = {
  packagesFolder: 'packages',
  runtimeSubpaths: [
    { subpath: 'react', runtime: 'react' },
    { subpath: 'server', runtime: 'node' },
  ],
  exceptions: [],
  testRunnerSegment: 'testing',
};

const ENTRIES = { '.': 'index', './react': 'react/index', './server': 'server/index' };

const manifest = (name: string, entries: Record<string, string>) =>
  JSON.stringify({
    name,
    type: 'module',
    exports: Object.fromEntries(
      Object.entries(entries).map(([key, dist]) => [
        key,
        { types: `./dist/${dist}.d.ts`, default: `./dist/${dist}.js` },
      ]),
    ),
  });

const CLEAN_BUILD: Record<string, string> = {
  'dist/index.js': "export { version } from './version.js';",
  'dist/index.d.ts': "export { version } from './version.js';",
  'dist/version.js': 'export const version = 1;',
  'dist/version.d.ts': 'export declare const version = 1;',
  'dist/react/index.js':
    "import { useState } from 'react';\nexport const useVersion = () => useState(1);",
  'dist/react/index.d.ts':
    "import type { ReactNode } from 'react';\nexport declare const useVersion: () => ReactNode;",
  'dist/server/index.js':
    "import { readFileSync } from 'node:fs';\nexport const read = (p) => readFileSync(p);",
  'dist/server/index.d.ts': 'export declare const read: (p: string) => unknown;',
};

function packageRepo(
  build: Record<string, string>,
  others: Record<string, string> = {},
  entries: Record<string, string> = ENTRIES,
) {
  const files: Record<string, string> = {
    'scripts/anchor.ts': 'export {};',
    'packages/kit/package.json': manifest('@acme/kit', entries),
    ...others,
  };
  for (const [path, text] of Object.entries(build)) files[`packages/kit/${path}`] = text;
  const repo = tempRepo(files);
  repos.push(repo);
  return createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: '.', anchor: 'scripts/anchor.ts' } },
  });
}

const run = async (
  index: 0 | 1,
  reader: ReturnType<typeof packageRepo>,
  facts: EntryPurityFacts = FACTS,
) => {
  const guard = entryPurityGuard.build(facts)[index];
  const findings = await guard.run(contextOf(reader));
  return findings.map((f) => `${f.file} — ${f.detail}`);
};
const purity = (reader: ReturnType<typeof packageRepo>, facts?: EntryPurityFacts) =>
  run(0, reader, facts);
const loads = (reader: ReturnType<typeof packageRepo>, facts?: EntryPurityFacts) =>
  run(1, reader, facts);

describe('entry purity', () => {
  it('pass a universal root while its React and Node entries use their runtimes', async () => {
    expect(await purity(packageRepo(CLEAN_BUILD))).toEqual([]);
  });

  it('FLAG a universal root whose built JavaScript reaches a node: module through one of its files', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/version.js': "import { hostname } from 'node:os';\nexport const version = hostname();",
    };
    expect(await purity(packageRepo(build))).toEqual([
      'packages/kit/dist/version.js — @acme/kit reaches node:os (node)',
    ]);
  });

  it('FLAG a universal root reaching a Node module named without the node: prefix', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/version.js': "import { join } from 'path';\nexport const version = join('a');",
    };
    expect(await purity(packageRepo(build))).toEqual([
      'packages/kit/dist/version.js — @acme/kit reaches path (node)',
    ]);
  });

  it('FLAG a universal root whose declaration files import React types though its JavaScript is clean', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/version.d.ts':
        "import type * as React from 'react';\nexport declare const version: React.ReactNode;",
    };
    expect(await purity(packageRepo(build))).toEqual([
      'packages/kit/dist/version.d.ts — @acme/kit reaches react (react)',
    ]);
  });

  it('FLAG a universal root whose declaration files reference the Node types', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/version.d.ts': '/// <reference types="node" />\nexport declare const version: Buffer;',
    };
    expect(await purity(packageRepo(build))).toEqual([
      'packages/kit/dist/version.d.ts — @acme/kit reaches /// <reference types="node" /> (node)',
    ]);
  });

  it('FLAG a universal root importing a browser runtime or a stylesheet', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/version.js':
        "import { getAuth } from 'firebase/auth';\nimport './theme.css';\nexport const version = getAuth;",
    };
    expect(await purity(packageRepo(build))).toEqual([
      'packages/kit/dist/version.js — @acme/kit reaches firebase/auth (browser)',
      'packages/kit/dist/version.js — @acme/kit reaches ./theme.css (browser)',
    ]);
  });

  it("FLAG a universal root importing a sibling package's runtime-specific entry", async () => {
    const other = {
      'packages/ui/package.json': manifest('@acme/ui', { '.': 'index', './react': 'react/index' }),
      'packages/ui/dist/index.js': 'export const tone = 1;',
      'packages/ui/dist/index.d.ts': 'export declare const tone = 1;',
      'packages/ui/dist/react/index.js':
        "import { useState } from 'react';\nexport const Button = useState;",
      'packages/ui/dist/react/index.d.ts': 'export declare const Button: unknown;',
    };
    const build = {
      ...CLEAN_BUILD,
      'dist/version.js':
        "import { Button } from '@acme/ui/react';\nimport { tone } from '@acme/ui';\nexport const version = [Button, tone];",
    };
    expect(await purity(packageRepo(build, other))).toEqual([
      'packages/kit/dist/version.js — @acme/kit reaches @acme/ui/react (react entry)',
    ]);
  });

  it('pass an entry the subpath convention does not mark when it is a reviewed exception for its runtime', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/version.js': "import { hostname } from 'node:os';\nexport const version = hostname();",
    };
    const facts = {
      ...FACTS,
      exceptions: [{ entry: '@acme/kit', runtime: 'node' as const, why: 'a server-only package' }],
    };
    expect(await purity(packageRepo(build), facts)).toEqual([]);
  });

  it('FLAG an exception that is stale because its entry reaches no runtime-specific module', async () => {
    const facts = {
      ...FACTS,
      exceptions: [{ entry: '@acme/kit', runtime: 'node' as const, why: 'a server-only package' }],
    };
    expect(await purity(packageRepo(CLEAN_BUILD), facts)).toEqual([
      '@acme/kit — the exception is stale: the entry reaches no runtime-specific module',
    ]);
  });

  it('FLAG an exception that names no entry', async () => {
    const facts = {
      ...FACTS,
      exceptions: [{ entry: '@acme/kit/gone', runtime: 'node' as const, why: 'removed' }],
    };
    expect(await purity(packageRepo(CLEAN_BUILD), facts)).toEqual([
      '@acme/kit/gone — the exception names no entry of any package',
    ]);
  });

  it('FLAG an entry that is not built, never reading it as clean', async () => {
    const { 'dist/index.js': _js, ...build } = CLEAN_BUILD;
    expect(await purity(packageRepo(build))).toEqual([
      'packages/kit/dist/index.js — @acme/kit is not built — build the packages before the guard runs',
    ]);
  });

  it('require every fact, each subpath and exception naming a runtime', () => {
    expect(
      factProblemsOf(entryPurityGuard, {
        packagesFolder: '',
        runtimeSubpaths: [{ subpath: 'react/x', runtime: 'gui' }],
        exceptions: [{ entry: '@acme/kit', runtime: 'node', why: '' }],
        testRunnerSegment: 'server/testing',
      }),
    ).toEqual([
      'packagesFolder is missing',
      'testRunnerSegment names no single subpath segment',
      'a runtimeSubpaths entry names no single subpath segment',
      'runtimeSubpaths entry react/x names no runtime (node, react, browser, style)',
      'exceptions entry @acme/kit carries no why',
    ]);
  });
});

describe('entries load under Node', () => {
  it('pass when every universal and Node entry evaluates; a React entry is never loaded', async () => {
    expect(await loads(packageRepo(CLEAN_BUILD))).toEqual([]);
  });

  it('FLAG a universal entry that throws while it evaluates, naming the error', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/version.js': "export const version = 1;\nthrow new TypeError('version table missing');",
    };
    expect(await loads(packageRepo(build))).toEqual([
      'packages/kit/dist/index.js — @acme/kit does not load under Node: TypeError: version table missing',
    ]);
  });

  it('never load a test-runner entry, which evaluates only inside the test runner', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/server/testing/index.js':
        "throw new Error('Vitest mocker was not initialized in this environment.');",
      'dist/server/testing/index.d.ts': 'export {};',
    };
    const entries = { ...ENTRIES, './server/testing': 'server/testing/index' };
    expect(await loads(packageRepo(build, {}, entries))).toEqual([]);
  });

  it('load a Node entry whose last segment only resembles the test-runner segment', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/testing/index.js': "throw new TypeError('not a test-runner entry');",
      'dist/testing/index.d.ts': 'export {};',
    };
    const entries = { ...ENTRIES, './testing': 'testing/index' };
    expect(await loads(packageRepo(build, {}, entries))).toEqual([
      'packages/kit/dist/testing/index.js — @acme/kit/testing does not load under Node: TypeError: not a test-runner entry',
    ]);
  });

  it('FLAG a Node entry that imports a module Node cannot find', async () => {
    const build = {
      ...CLEAN_BUILD,
      'dist/server/index.js': "import { gone } from './gone.js';\nexport const read = gone;",
    };
    const [finding] = await loads(packageRepo(build));
    expect(finding).toMatch(
      /^packages\/kit\/dist\/server\/index\.js — @acme\/kit\/server does not load under Node: Error \[ERR_MODULE_NOT_FOUND\]: Cannot find module .*gone\.js/,
    );
  });
});
