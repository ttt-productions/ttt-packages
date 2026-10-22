import { afterAll } from 'vitest';
import type { GenericGuardDefinition } from '../../src/node/suite/config.js';
import { matchPattern, ownerOnly } from '../../src/shapes/shapes.js';
import { registerSuiteOf } from '../../src/node/suite/register.js';
import { tempRepo } from '../helpers/temp-repo.js';

const repo = tempRepo({
  'src/app/page.tsx': "export const page = readConfig('app');",
  'src/config/provider.ts': "export const config = readConfig('app');",
});
afterAll(() => repo.remove());

const pageReads: GenericGuardDefinition<{ page: string }> = {
  id: 'pageReads',
  absentWhen: false,
  factProblems: (f) => (f?.page ? [] : ['page is missing']),
  build: (f) => [
    {
      title: 'the page reads its file',
      description: 'The page exists.',
      run: (context) => (context.file(f.page).text ? [] : [{ file: f.page, detail: 'empty' }]),
    },
  ],
};

registerSuiteOf(
  {
    layout: { repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/app/page.tsx' } } },
    generic: { pageReads: { page: 'src/app/page.tsx' } },
    business: [
      ownerOnly({
        title: 'config is read only by its provider and the page',
        description: 'Read config through the provider.',
        scope: { roots: ['app'], kinds: ['code'], tests: false },
        match: matchPattern(/\breadConfig\(/),
        owners: ['src/config/provider.ts', 'src/app/page.tsx'],
        samples: { flags: ["readConfig('app')"], passes: ['useConfig()'] },
      }),
    ],
  },
  [pageReads] as ReadonlyArray<GenericGuardDefinition<never>>,
);
