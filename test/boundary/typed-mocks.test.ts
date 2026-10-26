import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
};
registerSuiteOf(
  {
    layout,
    generic: {
      typedMocks: {
        importAliases: {},
        fakes: [
          {
            module: 'react-easy-crop',
            owner: 'packages/file-input/__tests__/helpers/react-easy-crop-fake.tsx',
          },
        ],
        typedHelpers: [
          {
            owner: '@ttt-productions/dev-standards/testing',
            names: ['stubModule', 'passThroughModule'],
          },
          {
            owner: 'packages/dev-standards/src/testing.ts',
            names: ['stubModule', 'passThroughModule'],
          },
          { owner: 'test/client-firestore-fake.ts', names: ['clientFirestoreFake'] },
        ],
        forbiddenOverrides: [],
      },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => definition.id === 'typedMocks'),
);
