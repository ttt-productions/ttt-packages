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

  it('analyzes the shared source folder as one of its trees: an import of it resolves, one of a missing file there is flagged', async () => {
    const sharedRepo = tempRepo({
      'src/app/page.tsx': [
        "import { LIMIT } from '../../shared/limits.js';",
        "import { gone } from '../../shared/gone.js';",
      ].join('\n'),
      'shared/limits.ts': 'export const LIMIT = 1;',
    });
    try {
      const sharedReader = createRepoReader({
        repoRoot: sharedRepo.root,
        roots: {
          app: { path: 'src', anchor: 'src/app/page.tsx' },
          sharedSource: { path: 'shared', anchor: 'shared/limits.ts' },
        },
      });
      const [guard] = importPathGuard.build(facts);
      const findings = await guard.run(contextOf(sharedReader));
      expect(findings.map((f) => `${f.file} ${f.detail.split(':')[0]}`)).toEqual([
        'src/app/page.tsx unresolved import',
      ]);
      expect(findings[0]!.detail).toContain('shared/gone');
    } finally {
      sharedRepo.remove();
    }
  });

  it('analyzes the end-to-end, script, and Worker trees: a re-export there is flagged, an import of the app resolves', async () => {
    const treesRepo = tempRepo({
      'src/app/page.tsx': 'export const page = 1;',
      'src/test/matchers.ts': 'export const anything = 1;',
      'e2e/fixtures/auth.fixture.ts': [
        "export { expect } from '@playwright/test';",
        'export const test = 1;',
      ].join('\n'),
      'e2e/fixtures/test-base.ts': "export { test } from './auth.fixture';",
      'e2e/home.spec.ts': "import { anything } from '../src/test/matchers';",
      'e2e-hosted-dev/helpers/journey.ts': "export { BUDGET } from './budget.mjs';",
      'e2e-hosted-dev/helpers/budget.mjs': 'export const BUDGET = 1;',
      'scripts/run.mjs': "export { page } from '../src/app/page';",
      'edge-worker/src/handler.ts': "export { route } from './route';",
      'edge-worker/src/route.ts': 'export const route = 1;',
    });
    try {
      const treesReader = createRepoReader({
        repoRoot: treesRepo.root,
        roots: {
          app: { path: 'src', anchor: 'src/app/page.tsx' },
          e2e: { path: 'e2e', anchor: 'e2e/home.spec.ts' },
          hostedE2e: { path: 'e2e-hosted-dev', anchor: 'e2e-hosted-dev/helpers/budget.mjs' },
          scripts: { path: 'scripts', anchor: 'scripts/run.mjs' },
          workers: { edge: { path: 'edge-worker/src', anchor: 'edge-worker/src/route.ts' } },
        },
      });
      const [guard] = importPathGuard.build(facts);
      const findings = await guard.run(contextOf(treesReader));
      expect(findings.map((f) => `${f.file} ${f.detail.split(':')[0]}`)).toEqual([
        'e2e-hosted-dev/helpers/journey.ts reexport outside index',
        'e2e/fixtures/auth.fixture.ts reexport outside index',
        'e2e/fixtures/test-base.ts reexport outside index',
        'edge-worker/src/handler.ts reexport outside index',
        'scripts/run.mjs reexport outside index',
      ]);
    } finally {
      treesRepo.remove();
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
