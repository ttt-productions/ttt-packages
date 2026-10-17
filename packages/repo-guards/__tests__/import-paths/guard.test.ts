// The import-path guard read through the one reader: tests are held to the rules too, and a
// test's own module mocks are not.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GuardContext } from '../../src/guard.js';
import { importPathGuard, unusedIndexMembers } from '../../src/modules/import-paths/guard.js';
import { createRepoReader, type RepoReader } from '../../src/reader/reader.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo;
let reader: RepoReader;

beforeAll(() => {
  repo = tempRepo({
    'src/kit/index.ts': "export { Button } from './button';",
    'src/kit/button.tsx': 'export const Button = 1;\nexport const Spare = 2;',
    'src/app/page.tsx': "import { Button } from '@/kit/button';",
    'src/__tests__/page.test.tsx': "import { Spare } from '@/kit/button';\nvi.mock('@/kit/button');",
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

const context = (): GuardContext => ({ reader, files: (s) => reader.files(s), file: (p) => reader.file(p) });
const facts = { importAliases: { '@/': 'src/' }, exceptions: [] };

describe('the import-path guard over the reader', () => {
  it('FLAGS an import past an index, and lets a test import a name the index does not forward', async () => {
    const [guard] = importPathGuard.build(facts);
    const findings = await guard.run(context());
    expect(findings.map((f) => `${f.file} ${f.detail.split(':')[0]}`)).toEqual(['src/app/page.tsx import past index']);
  });

  it('reads index members nothing outside the folder imports', () => {
    expect(unusedIndexMembers(reader, facts)).toEqual([
      { file: 'functions/src/index.ts', unused: ['run'] },
      { file: 'src/kit/index.ts', unused: ['Button'] },
    ]);
  });

  it('refuses facts with an exception that carries no why', () => {
    expect(importPathGuard.factProblems({ importAliases: {}, exceptions: [{ file: 'functions/src/index.ts', why: '' }] })).toEqual([
      'exception functions/src/index.ts carries no why',
    ]);
  });
});
