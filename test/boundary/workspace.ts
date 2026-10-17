// The boundary suite reads the workspace through repo-guards' one reader: each tree it checks is a
// root the reader walks once under one scope policy (file kinds by name; dependency, build, and dot
// folders skipped; an unreadable folder fails). A test reads only the files these hand it, or a named
// build output or manifest file.

import ts from 'typescript';
import type { FileView } from '@ttt-productions/repo-guards';
import { createRepoReader, type FileKind, type RepoReader } from '@ttt-productions/repo-guards/node';
import { REPO_ROOT } from './leak-utils';

/** One tree as a reader root. Its anchor is a long-lived file the walk must reach, or the suite fails. */
function tree(path: string, anchor: string): RepoReader {
  const reader = createRepoReader({ repoRoot: REPO_ROOT, roots: { app: { path, anchor } } });
  const unreached = reader.unreachedAnchors();
  if (unreached.length) throw new Error(`the boundary suite's walk never reached ${unreached.join(', ')}`);
  return reader;
}

export const packagesTree = tree('packages', 'packages/media-schemas/src/helpers.ts');
export const docsTree = tree('docs', 'docs/packages/package-architecture.md');
export const workflowsTree = tree('.github/workflows', '.github/workflows/publish.yml');

/** Every file of the given kinds in a tree, test code included. */
export const filesOf = (reader: RepoReader, kinds: readonly FileKind[]): FileView[] =>
  reader.files({ roots: ['app'], kinds, tests: true });

const PACKAGE_SOURCE = /^packages\/[^/]+\/src\//;
const MANIFEST = /^packages\/[^/]+\/package\.json$/;

/** The package folder a workspace path belongs to. */
export const packageOf = (path: string): string => path.split('/')[1];

/** Every file under a package's `src` of the given kinds. */
export const packageSource = (kinds: readonly FileKind[]): FileView[] =>
  filesOf(packagesTree, kinds).filter((file) => PACKAGE_SOURCE.test(file.path));

export interface WorkspacePackage<M> {
  /** The folder under `packages/`. */
  dir: string;
  manifest: M;
}

/** Every workspace package: each folder under `packages/` with a manifest, and that manifest. */
export function workspacePackages<M = Record<string, unknown>>(): Array<WorkspacePackage<M>> {
  return filesOf(packagesTree, ['config'])
    .filter((file) => MANIFEST.test(file.path))
    .map((file) => ({ dir: packageOf(file.path), manifest: JSON.parse(file.text) as M }));
}

/**
 * Every module a code file loads — an import or re-export, a dynamic `import()`, or a `require()` —
 * with the names a static import binds. Read from the parse, so a specifier inside a string or a
 * comment is not an import.
 */
export function importsOf(file: FileView): Array<{ specifier: string; names: string[] }> {
  const found: Array<{ specifier: string; names: string[] }> = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : undefined;
      const names = bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => (e.propertyName ?? e.name).text) : [];
      found.push({ specifier: node.moduleSpecifier.text, names });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, names: [] });
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return found;
}
