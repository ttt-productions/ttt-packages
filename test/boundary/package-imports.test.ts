import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
};
const PACKAGES = { packagesFolder: 'packages' };

registerSuiteOf(
  {
    layout,
    generic: {
      packageImports: PACKAGES,
      packageImportCycles: PACKAGES,
      entryPurity: {
        ...PACKAGES,
        runtimeSubpaths: [
          { subpath: 'react', runtime: 'react' },
          { subpath: 'server', runtime: 'node' },
          { subpath: 'node', runtime: 'node' },
          { subpath: 'client', runtime: 'browser' },
          { subpath: 'firestore-client', runtime: 'browser' },
          { subpath: 'browser', runtime: 'browser' },
          { subpath: 'styles', runtime: 'style' },
        ],
        exceptions: [
          {
            entry: '@ttt-productions/media-processing-core',
            runtime: 'node',
            why: 'the package is server-only: its root runs ffmpeg and reads local files',
          },
          {
            entry: '@ttt-productions/chat-react',
            runtime: 'react',
            why: 'the package is the chat React surface; its root is that surface',
          },
          {
            entry: '@ttt-productions/ttt-core/safety',
            runtime: 'node',
            why: 'its one sha256 helper hashes with node:crypto, and every consumer runs under Node',
          },
        ],
      },
      applicationDataImports: { ...PACKAGES, applicationDataPackages: ['ttt-core', 'q-core'] },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) =>
    ['packageImports', 'packageImportCycles', 'entryPurity', 'applicationDataImports'].includes(
      definition.id,
    ),
  ),
);
