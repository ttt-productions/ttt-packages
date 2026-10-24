import { afterEach, describe, expect, it } from 'vitest';
import type { Guard } from '../../src/guard.js';
import {
  entryPointGuard,
  isolatedRootsGuard,
  noOutsideCheckoutGuard,
  tsconfigAliasGuard,
  type EntryPointFacts,
} from '../../src/modules/repo/cross-root.js';
import { projectScriptGuard } from '../../src/modules/repo/project-scripts.js';
import { moduleSpecifiers } from '../../src/modules/repo/specifiers.js';
import { createRepoReader } from '../../src/node/reader.js';
import { viewOfText } from '../../src/reader/view.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';
import { factProblemsOf } from '../helpers/configured.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const BASE = {
  'package.json': JSON.stringify({ dependencies: { '@scope/ui-core': '^1.2.3' } }),
  'functions/package.json': JSON.stringify({ dependencies: { 'firebase-admin': '^13.0.0' } }),
  'tsconfig.json':
    '{\n  // the app alias\n  "compilerOptions": { "paths": { "@/*": ["./src/*"], }, },\n}',
  'functions/tsconfig.json': '{ "compilerOptions": { "outDir": "lib" } }',
  'src/index.ts': 'export {};',
  'functions/src/index.ts': 'export {};',
  'scripts/run.mjs': 'export {};',
};

async function run(guard: Guard, files: Record<string, string>) {
  repo = tempRepo({ ...BASE, ...files });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/index.ts' },
      functions: { path: 'functions/src', anchor: 'functions/src/index.ts' },
      scripts: { path: 'scripts', anchor: 'scripts/run.mjs' },
    },
  });
  const findings = await guard.run(contextOf(reader));
  return findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);
}

describe('module specifiers are read from the parse', () => {
  it('sees a specifier wrapped onto the next line, a lazy import, a require, and keeps lines true under a block comment', () => {
    const file = viewOfText(
      'src/a.ts',
      [
        '/**',
        " * Once read from '../../functions/src/theme'.",
        ' */',
        "import { a } from '@tanstack/react-query';",
        'import { b } from',
        "  '../../functions/src/b';",
        'const c = await import(',
        "  './c'",
        ');',
        "const d = require('d');",
        "export type { E } from './e';",
      ].join('\n'),
    );
    expect(moduleSpecifiers(file)).toEqual([
      { spec: '@tanstack/react-query', line: 4, typeOnly: false },
      { spec: '../../functions/src/b', line: 5, typeOnly: false },
      { spec: './c', line: 7, typeOnly: false },
      { spec: 'd', line: 10, typeOnly: false },
      { spec: './e', line: 11, typeOnly: true },
    ]);
  });
});

describe('roots that are separate projects never import one another', () => {
  const [guard] = isolatedRootsGuard.build({
    isolatedRoots: ['app', 'functions'],
    importAliases: { '@/': 'src/' },
  });

  it('passes in-root, alias, and package imports, and a test that crosses', async () => {
    expect(
      await run(guard, {
        'src/hooks/use-games.ts':
          "import { p } from '@/lib/paths';\nimport { q } from '@tanstack/react-query';\nimport type { G } from '../lib/types';",
        'functions/src/games/finish.ts':
          "import { p } from '../shared/paths';\n// '@/lib/cache' in prose only",
        'src/__tests__/cross.test.ts': "import { x } from '../../functions/src/x';",
      }),
    ).toEqual([]);
  });

  it('flags a crossing from either side: relative, wrapped, lazy, required, aliased, and named by path', async () => {
    expect(
      await run(guard, {
        'src/hooks/a.ts': "import { gamePath } from\n  '../../functions/src/shared/paths';",
        'src/lib/b.ts': "const mod = await import('../../functions/src/shared/auth');",
        'src/lib/c.ts': "import { x } from 'functions/src/shared/x';",
        'functions/src/games/d.ts': "import { cache } from '@/lib/cache';",
        'functions/src/e.ts': "const p = require('../../src/lib/paths');",
      }),
    ).toEqual([
      'functions/src/e.ts:1 imports from the app root: ../../src/lib/paths',
      'functions/src/games/d.ts:1 imports from the app root: @/lib/cache',
      'src/hooks/a.ts:1 imports from the functions root: ../../functions/src/shared/paths',
      'src/lib/b.ts:1 imports from the functions root: ../../functions/src/shared/auth',
      'src/lib/c.ts:1 imports from the functions root: functions/src/shared/x',
    ]);
  });

  it('refuses facts with one root to keep apart or a role that is not a code root', () => {
    expect(
      factProblemsOf(isolatedRootsGuard, {
        isolatedRoots: ['app', 'coreDist'],
        importAliases: {},
      }),
    ).toEqual(['isolatedRoots names coreDist, which is not a code root role']);
    expect(
      factProblemsOf(isolatedRootsGuard, {
        isolatedRoots: ['app'],
        importAliases: undefined,
      }),
    ).toEqual(['isolatedRoots needs at least two roots to keep apart', 'importAliases is missing']);
  });
});

describe('every tsconfig path alias resolves inside its own root', () => {
  const [guard] = tsconfigAliasGuard.build({
    tsconfigs: [
      { file: 'tsconfig.json', root: 'app' },
      { file: 'functions/tsconfig.json', root: 'functions' },
    ],
  });

  it('passes an app alias into its root and a Functions config with no paths', async () => {
    expect(await run(guard, {})).toEqual([]);
  });

  it('flags an alias into another root, a sibling checkout, or the repository root', async () => {
    expect(
      await run(guard, {
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            paths: {
              '@/*': ['./src/*'],
              '@fn/*': ['./functions/src/*'],
              '@pkg/*': ['../packages/*'],
              '~/*': ['./*'],
            },
          },
        }),
        'functions/tsconfig.json': JSON.stringify({
          compilerOptions: { baseUrl: '.', paths: { '@/*': ['../src/*'], '#/*': ['src/*'] } },
        }),
      }),
    ).toEqual([
      'tsconfig.json alias resolves outside src: @fn/* → ./functions/src/*',
      'tsconfig.json alias resolves outside src: @pkg/* → ../packages/*',
      'tsconfig.json alias resolves outside src: ~/* → ./*',
      'functions/tsconfig.json alias resolves outside functions/src: @/* → ../src/*',
    ]);
  });

  it('flags a tsconfig that is gone, or names a root the layout lacks', async () => {
    const [missing] = tsconfigAliasGuard.build({
      tsconfigs: [
        { file: 'workers/tsconfig.json', root: 'app' },
        { file: 'tsconfig.json', root: 'edge' },
      ],
    });
    expect(await run(missing, {})).toEqual([
      'workers/tsconfig.json the tsconfig does not exist',
      'tsconfig.json names the root edge, which the layout does not declare',
    ]);
  });

  it('refuses facts with no tsconfig', () => {
    expect(tsconfigAliasGuard.factProblems({ tsconfigs: [] })).toEqual(['tsconfigs is empty']);
  });
});

describe('each package is imported from the entry point matching the runtime', () => {
  const FACTS: EntryPointFacts = {
    packageScope: '@scope',
    serverRoots: ['functions'],
    clientRoots: ['app'],
    serverOnlyPaths: [{ path: 'src/server', why: 'route handlers run on the server' }],
  };
  const [guard] = entryPointGuard.build(FACTS);
  const CLEAN = {
    'src/server/admin.ts': "import { getAuth } from 'firebase-admin/auth';",
    'src/components/card.tsx':
      "import { Button } from '@scope/ui-core/react';\nimport { getFirestore } from 'firebase/firestore';\n// firebase-admin in prose",
    'functions/src/finish.ts':
      "import { onCall } from 'firebase-functions/v2/https';\nimport { FieldValue } from 'firebase-admin/firestore';\nimport { CACHE } from '@scope/query-core';",
  };

  it('passes runtime-matched entries and a server-only path inside the client root', async () => {
    expect(await run(guard, CLEAN)).toEqual([]);
  });

  it('flags every client-only entry in a server root and every server-only entry in a client root', async () => {
    expect(
      await run(guard, {
        ...CLEAN,
        'functions/src/bad.ts': [
          "import { Button } from\n  '@scope/ui-core/react';",
          "import { upload } from '@scope/helpers/browser';",
          "import { useAuth } from '@scope/auth-core/client';",
          "import '@scope/theme-core/styles.css';",
          "import { useState } from 'react';",
          "import { createRoot } from 'react-dom/client';",
          "const next = await import('next');",
          "import './game.css';",
        ].join('\n'),
        'src/lib/bad.ts': [
          "import admin from 'firebase-admin';",
          "import { setClaims } from '@scope/auth-core/admin';",
          "export { paths } from '@scope/core/server';",
        ].join('\n'),
      }),
    ).toEqual([
      'functions/src/bad.ts:1 @scope/ui-core/react (client-only package entry point)',
      'functions/src/bad.ts:3 @scope/helpers/browser (client-only package entry point)',
      'functions/src/bad.ts:4 @scope/auth-core/client (client-only package entry point)',
      'functions/src/bad.ts:5 @scope/theme-core/styles.css (stylesheet side effect)',
      'functions/src/bad.ts:6 react (React or Next.js runtime)',
      'functions/src/bad.ts:7 react-dom/client (React or Next.js runtime)',
      'functions/src/bad.ts:8 next (React or Next.js runtime)',
      'functions/src/bad.ts:9 ./game.css (stylesheet side effect)',
      'src/lib/bad.ts:1 firebase-admin (Admin SDK)',
      'src/lib/bad.ts:2 @scope/auth-core/admin (server-only package entry point)',
      'src/lib/bad.ts:3 @scope/core/server (server-only package entry point)',
    ]);
  });

  it('flags a stale server-only path', async () => {
    const [stale] = entryPointGuard.build({
      ...FACTS,
      serverOnlyPaths: [{ path: 'src/gone', why: 'was server-only' }],
    });
    expect(await run(stale, CLEAN)).toEqual([
      'src/gone stale server-only path: it no longer exists',
      'src/server/admin.ts:1 firebase-admin/auth (Admin SDK)',
    ]);
  });

  it('refuses facts with no scope, a root on both sides, or an unexplained server-only path', () => {
    expect(
      entryPointGuard.factProblems({
        packageScope: 'scope',
        serverRoots: ['app'],
        clientRoots: ['app'],
        serverOnlyPaths: [{ path: 'src/x', why: '' }],
      }),
    ).toEqual([
      'packageScope is not an npm scope (@name)',
      'app is both a server and a client root',
      'serverOnlyPaths entry src/x carries no why',
    ]);
  });
});

describe('nothing is imported from, or depended on at, a path outside the repository', () => {
  const [guard] = noOutsideCheckoutGuard.build({});

  it('passes in-repo relative imports, packages, and registry ranges', async () => {
    expect(
      await run(guard, {
        'src/lib/theme.ts':
          "import { t } from '@scope/theme-core';\nimport { c } from '../../src/lib/cache';\n// a checkout beside the repo in prose",
        'scripts/x.mjs': "import { y } from '../src/lib/theme.ts';",
      }),
    ).toEqual([]);
  });

  it('flags an import climbing above the repository from any root, tests included, and every local-path range', async () => {
    expect(
      await run(guard, {
        'src/lib/theme.ts': "import { theme } from\n  '../../../shared/ui-core/src';",
        'functions/src/shared/auth.ts':
          "const m = require('../../../../elsewhere/core/dist/index.js');",
        'scripts/__tests__/x.test.mjs': "import { z } from '../../../shared/z';",
        'package.json': JSON.stringify({
          dependencies: { a: 'file:../shared/a', b: 'link:./b' },
          devDependencies: {
            c: '../elsewhere/c',
            d: '~/checkouts/d',
            e: '/abs/e',
            f: '../packed/f-1.0.0.tgz',
            g: '^1.0.0',
          },
          peerDependencies: { h: 'file:./h' },
        }),
        'functions/package.json': JSON.stringify({ optionalDependencies: { i: 'link:../i' } }),
      }),
    ).toEqual([
      'functions/src/shared/auth.ts:1 imports from outside the repository: ../../../../elsewhere/core/dist/index.js',
      'scripts/__tests__/x.test.mjs:1 imports from outside the repository: ../../../shared/z',
      'src/lib/theme.ts:1 imports from outside the repository: ../../../shared/ui-core/src',
      'functions/package.json depends on a local path: optionalDependencies.i → link:../i',
      'package.json depends on a local path: dependencies.a → file:../shared/a',
      'package.json depends on a local path: dependencies.b → link:./b',
      'package.json depends on a local path: devDependencies.c → ../elsewhere/c',
      'package.json depends on a local path: devDependencies.d → ~/checkouts/d',
      'package.json depends on a local path: devDependencies.e → /abs/e',
      'package.json depends on a local path: devDependencies.f → ../packed/f-1.0.0.tgz',
      'package.json depends on a local path: peerDependencies.h → file:./h',
    ]);
  });
});

describe('scripts that reach a real project take it as an argument', () => {
  const [guard] = projectScriptGuard.build({
    projectIds: ['app-dev', 'app-prod'],
    privilegedScripts: ['scripts/export.mjs'],
  });
  const CLEAN = {
    'scripts/export.mjs': [
      "const { initializeApp, applicationDefault } = await import('firebase-admin/app');",
      'const app = initializeApp({ credential: applicationDefault(), projectId: options.project });',
      'for (const c of await db.listCollections()) await read(c);',
      "// a comment may say 'app-prod'",
    ].join('\n'),
    'scripts/check.mjs': "export const KNOWN = new Set(['app-dev', 'app-prod']);",
    'scripts/__tests__/export.test.mjs':
      "import admin from 'firebase-admin';\nrun({ project: 'app-dev' });",
  };

  it('passes an argument-driven privileged script, a non-privileged one naming projects, and tests', async () => {
    expect(await run(guard, CLEAN)).toEqual([]);
  });

  it('flags a defaulted project, a projectId literal, and a literal collection path', async () => {
    expect(
      await run(guard, {
        ...CLEAN,
        'scripts/probe.mjs': [
          "import { initializeApp } from 'firebase-admin/app';",
          "const app = initializeApp({ projectId: 'somewhere' });",
          "const project = process.argv[2] ?? 'app-dev';",
          "const snap = await db.collection('games').get();",
          'const one = await db.doc(`games/x`).get();',
        ].join('\n'),
      }),
    ).toEqual([
      'scripts/probe.mjs:2 names a project',
      'scripts/probe.mjs:3 names a project',
      "scripts/probe.mjs:4 hardcodes a path: .collection('games')",
      'scripts/probe.mjs:5 hardcodes a path: .doc(`games/x`)',
    ]);
  });

  it('flags a known privileged script it no longer recognises, or one that is gone', async () => {
    expect(await run(guard, { ...CLEAN, 'scripts/export.mjs': 'export const x = 1;' })).toEqual([
      'scripts/export.mjs stale entry: no longer recognised as bringing up the Admin SDK',
    ]);
    const [gone] = projectScriptGuard.build({
      projectIds: ['app-dev'],
      privilegedScripts: ['scripts/gone.mjs'],
    });
    expect(await run(gone, CLEAN)).toEqual([
      'scripts/gone.mjs the privileged script is not a scripts source file (gone, moved, or a test)',
    ]);
  });

  it('refuses facts with no project id or no known privileged script', () => {
    expect(projectScriptGuard.factProblems({ projectIds: [], privilegedScripts: [] })).toEqual([
      'projectIds is empty',
      'privilegedScripts is empty',
    ]);
  });
});
