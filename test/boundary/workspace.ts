import type { FileView } from '@ttt-productions/repo-guards';
import {
  createRepoReader,
  type FileKind,
  type RepoReader,
} from '@ttt-productions/repo-guards/node';
import { REPO_ROOT } from './leak-utils';

function tree(path: string, anchor: string): RepoReader {
  const reader = createRepoReader({ repoRoot: REPO_ROOT, roots: { app: { path, anchor } } });
  const unreached = reader.unreachedAnchors();
  if (unreached.length)
    throw new Error(`the boundary suite's walk never reached ${unreached.join(', ')}`);
  return reader;
}

export const packagesTree = tree('packages', 'packages/media-schemas/src/helpers.ts');
export const docsTree = tree('docs', 'docs/packages/package-architecture.md');
export const workflowsTree = tree('.github/workflows', '.github/workflows/publish.yml');

export const filesOf = (reader: RepoReader, kinds: readonly FileKind[]): FileView[] =>
  reader.files({ roots: ['app'], kinds, tests: true });

const PACKAGE_SOURCE = /^packages\/[^/]+\/src\//;
const MANIFEST = /^packages\/[^/]+\/package\.json$/;

export const packageOf = (path: string): string => path.split('/')[1];

export const packageSource = (kinds: readonly FileKind[]): FileView[] =>
  filesOf(packagesTree, kinds).filter((file) => PACKAGE_SOURCE.test(file.path));

export interface WorkspacePackage<M> {
  dir: string;
  manifest: M;
}

export function workspacePackages<M = Record<string, unknown>>(): Array<WorkspacePackage<M>> {
  return filesOf(packagesTree, ['config'])
    .filter((file) => MANIFEST.test(file.path))
    .map((file) => ({ dir: packageOf(file.path), manifest: JSON.parse(file.text) as M }));
}
