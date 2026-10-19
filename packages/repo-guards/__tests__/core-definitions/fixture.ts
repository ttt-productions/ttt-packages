// A throwaway app with an installed core build, read through the one reader, for the core-definition
// guard tests. The core is installed at `node_modules/@fx/core/dist`, the app at `src` and
// `functions/src`.

import type { Finding, Guard, GuardContext } from '../../src/guard.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

export const CORE = 'node_modules/@fx/core/dist';

export interface Fixture {
  repo: TempRepo;
  reader: RepoReader;
  context: GuardContext;
  run(guard: Guard): Promise<Finding[]>;
}

/** A repository holding `files` plus the anchors every root needs. */
export function fixture(files: Record<string, string>): Fixture {
  const repo = tempRepo({
    'src/app.ts': 'export const app = 1;',
    'functions/src/index.ts': 'export const fn = 1;',
    'src/test/render.ts': 'export const render = 1;',
    [`${CORE}/index.js`]: "export * from './kinds.js';",
    ...files,
  });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/app.ts' },
      functions: { path: 'functions/src', anchor: 'functions/src/index.ts' },
      coreDist: { path: CORE, anchor: `${CORE}/index.js` },
    },
    testCodePaths: [{ path: 'src/test', why: 'shared render helpers' }],
  });
  const context = contextOf(reader);
  return { repo, reader, context, run: async (guard) => guard.run(context) };
}

/** Findings as `file:line — detail` lines, so a test states every expected finding exactly. */
export const lines = (findings: readonly Finding[]) =>
  findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} — ${f.detail}`);
