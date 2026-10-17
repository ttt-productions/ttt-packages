// What a code file imports, read from its parse: every static import and export-from, a side-effect
// import, a dynamic `import()`, a `require()`, an `import x = require()`, and a type-position
// `import()`. Reading the parse means a specifier wrapped onto the next line, or named inside a
// comment, is seen exactly as the compiler sees it.

import ts from 'typescript';
import type { FileView } from '../../reader/view.js';

export interface ModuleSpecifier {
  spec: string;
  line: number;
  /** True for `import type`, `export type … from`, and a type-position `import()`. */
  typeOnly: boolean;
}

const stringArgument = (node: ts.CallExpression): string | null => {
  const [first] = node.arguments;
  return first && ts.isStringLiteralLike(first) ? first.text : null;
};

/** Every module specifier a code file names, in source order. */
export function moduleSpecifiers(file: FileView): ModuleSpecifier[] {
  const sourceFile = file.sourceFile;
  const out: ModuleSpecifier[] = [];
  const add = (spec: string, node: ts.Node, typeOnly: boolean) =>
    out.push({ spec, line: file.lineOf(node.getStart(sourceFile)), typeOnly });
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text, node, !!node.importClause?.isTypeOnly);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      add(node.moduleSpecifier.text, node, node.isTypeOnly);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      add(node.moduleReference.expression.text, node, node.isTypeOnly);
    } else if (ts.isCallExpression(node)) {
      const spec = stringArgument(node);
      if (spec !== null) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(spec, node, false);
        else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add(spec, node, false);
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      add(node.argument.literal.text, node, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

/** The repo-relative path a relative specifier names from `fromPath`, or null for a package specifier. */
export function resolveRelative(fromPath: string, spec: string): string | null {
  if (!spec.startsWith('./') && !spec.startsWith('../') && spec !== '.' && spec !== '..') return null;
  const parts = fromPath.split('/').slice(0, -1);
  for (const segment of spec.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

/** True when walking a relative specifier from `fromPath` climbs above the repository root. */
export function escapesRepository(fromPath: string, relativePath: string, startDepth = fromPath.split('/').length - 1): boolean {
  let depth = startDepth;
  for (const segment of relativePath.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      depth -= 1;
      if (depth < 0) return true;
    } else depth += 1;
  }
  return false;
}

/** True when `path` is `folder` or lies under it. */
export const isUnder = (path: string, folder: string) => path === folder || path.startsWith(`${folder.replace(/\/$/, '')}/`);
