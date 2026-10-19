import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

// The package architecture's import and entry rules, run over this repository through the suite
// entry, exactly as an app's suite runs a guard: inside each package code imports the file that
// defines each name and only an entry index re-exports; no package has a runtime import cycle; every
// entry not declared runtime-specific reaches no Node, React, or browser runtime in its build, and
// every universal and Node entry loads under Node; and no generic package depends on an
// application-data package. The guards' own must-fail and must-pass cases are proven in repo-guards'
// tests.

const layout: RepoLayout = { repoRoot: REPO_ROOT, roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } } };
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
          { entry: '@ttt-productions/media-processing-core', runtime: 'node', why: 'the package is server-only: its root runs ffmpeg and reads local files' },
          { entry: '@ttt-productions/chat-react', runtime: 'react', why: 'the package is the chat React surface; its root is that surface' },
          { entry: '@ttt-productions/ttt-core/safety', runtime: 'node', why: 'its one sha256 helper hashes with node:crypto, and every consumer runs under Node' },
        ],
      },
      applicationDataImports: { ...PACKAGES, applicationDataPackages: ['ttt-core', 'q-core'] },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => ['packageImports', 'packageImportCycles', 'entryPurity', 'applicationDataImports'].includes(definition.id)),
);
