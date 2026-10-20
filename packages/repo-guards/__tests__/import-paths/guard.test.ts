// The import-path guard read through the one reader: tests are held to the rules too, and a
// test's own module mocks are not.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GuardContext } from '../../src/guard.js';
import { contextOf } from '../helpers/context.js';
import { importPathGuard, unusedIndexMembers } from '../../src/modules/import-paths/guard.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let reader: RepoReader;

beforeAll(() => {
  repo = tempRepo({
    'src/kit/index.ts': "export { Button } from './button';",
    'src/kit/button.tsx': 'export const Button = 1;\nexport const Spare = 2;',
    'src/app/page.tsx': "import { Button } from '@/kit/button';",
    'src/__tests__/page.test.tsx':
      "import { Spare } from '@/kit/button';\nvi.mock('@/kit/button');",
    'src/generated/out.ts': "export * from '../kit';",
    'functions/src/index.ts': "export { run } from './run';",
    'functions/src/run.ts': 'export const run = 1;',
  });
  reader = createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/app/page.tsx' },
      functions: { path: 'functions/src', anchor: 'functions/src/run.ts' },
    },
    exclusions: [{ path: 'src/generated', why: 'generated output' }],
  });
});
afterAll(() => repo.remove());

const context = (): GuardContext => contextOf(reader);
const facts = { importAliases: { '@/': 'src/' }, exceptions: [] };

describe('the import-path guard over the reader', () => {
  it('FLAGS an import past an index, and lets a test import a name the index does not forward', async () => {
    const [guard] = importPathGuard.build(facts);
    const findings = await guard.run(context());
    expect(findings.map((f) => `${f.file} ${f.detail.split(':')[0]}`)).toEqual([
      'src/app/page.tsx import past index',
    ]);
  });

  it('reads index members nothing outside the folder imports', () => {
    expect(unusedIndexMembers(reader, facts)).toEqual([
      { file: 'functions/src/index.ts', unused: ['run'] },
      { file: 'src/kit/index.ts', unused: ['Button'] },
    ]);
  });

  it('resolves an import of a file inside an excluded path, and flags one of a missing file there', async () => {
    const excluded = tempRepo({
      'src/app/page.tsx': 'export const page = 1;',
      'src/config/facts.ts': 'export const facts = 1;',
      'src/__tests__/facts.test.ts': [
        "import { facts } from '../config/facts.ts';",
        "import { gone } from '../config/gone.ts';",
      ].join('\n'),
    });
    try {
      const excludedReader = createRepoReader({
        repoRoot: excluded.root,
        roots: { app: { path: 'src', anchor: 'src/app/page.tsx' } },
        exclusions: [
          { path: 'src/config', why: 'the guard config spells what the guards look for' },
        ],
      });
      const [guard] = importPathGuard.build(facts);
      const findings = await guard.run(contextOf(excludedReader));
      expect(findings.map((f) => `${f.file} ${f.detail}`)).toEqual([
        "src/__tests__/facts.test.ts unresolved import: '../config/gone.ts' names no module under the analyzed trees (looked for src/config/gone.ts)",
      ]);
    } finally {
      excluded.remove();
    }
  });

  it('refuses facts with an exception that carries no why', () => {
    expect(
      importPathGuard.factProblems({
        importAliases: {},
        exceptions: [{ file: 'functions/src/index.ts', why: '' }],
      }),
    ).toEqual(['exceptions entry functions/src/index.ts carries no why']);
  });
});
