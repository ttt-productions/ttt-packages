// The one import reader. Every guard that asks which modules a file loads, and under which names,
// reads it here, from the parse the reader made once — so a specifier wrapped across lines is seen,
// and one inside a string or a comment never is. Internal to the package: no public entry exports it.

import ts from 'typescript';

/**
 * How a file names a module: a static import, an `export … from`, an `import x = require()`, a
 * dynamic `import()`, a `require()`, a test runner's module mock, or a type-position `import()`.
 */
export type ImportKind =
  'import' | 'export' | 'importEquals' | 'dynamic' | 'require' | 'mock' | 'importType';

/** The kinds that load a module at run time or bind its names: every kind but a mock and a type position. */
export const MODULE_LOADS: readonly ImportKind[] = Object.freeze([
  'import',
  'export',
  'importEquals',
  'dynamic',
  'require',
]);

/** The test runner calls whose first argument names a module. */
const MOCK_CALLEES: ReadonlySet<string> = new Set([
  'vi.mock',
  'vi.doMock',
  'vi.unmock',
  'vi.doUnmock',
  'vi.importActual',
  'vi.importMock',
  'jest.mock',
  'jest.doMock',
  'jest.unmock',
  'jest.requireActual',
  'jest.requireMock',
]);

/** One named binding: `{ a as b }` imports or exports `a` under `b`. */
export interface ImportedName {
  imported: string;
  /** The name it is bound to: the local name of an import, the exported name of an `export … from`. */
  local: string;
  typeOnly: boolean;
}

/** One place a file names a module. */
export interface ModuleImport {
  spec: string;
  kind: ImportKind;
  /** The statement, call, or type node that names the module. */
  node: ts.Node;
  /** The string literal that holds the specifier. */
  specifier: ts.StringLiteralLike;
  /** A statement directly in the file, not inside a module or namespace block. */
  topLevel: boolean;
  /** `import type`, `export type … from`, `import type x = require()`, or a type-position `import()`. */
  typeOnly: boolean;
  /** An `import '…'` that binds nothing. */
  sideEffect: boolean;
  /** The default import's local name. */
  defaultName: string | null;
  /** The name of `import * as X` or `export * as X from`. */
  namespace: string | null;
  /** `import * as X`, `export * from`, or `export * as X from`: the whole module. */
  star: boolean;
  named: readonly ImportedName[];
  /** A mock's callee (`vi.mock`); null for every other kind. */
  callee: string | null;
}

const read = new WeakMap<ts.SourceFile, readonly ModuleImport[]>();

const dottedCallee = (expression: ts.Expression): string | null =>
  ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
    ? `${expression.expression.text}.${expression.name.text}`
    : null;

function readImports(sourceFile: ts.SourceFile): ModuleImport[] {
  const out: ModuleImport[] = [];
  const add = (
    kind: ImportKind,
    node: ts.Node,
    specifier: ts.StringLiteralLike,
    rest: Partial<ModuleImport> = {},
  ) =>
    out.push({
      spec: specifier.text,
      kind,
      node,
      specifier,
      topLevel: node.parent === sourceFile,
      typeOnly: false,
      sideEffect: false,
      defaultName: null,
      namespace: null,
      star: false,
      named: [],
      callee: null,
      ...rest,
    });
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      add('import', node, node.moduleSpecifier, {
        typeOnly: !!clause?.isTypeOnly,
        sideEffect: !clause,
        defaultName: clause?.name?.text ?? null,
        namespace: bindings && ts.isNamespaceImport(bindings) ? bindings.name.text : null,
        star: !!bindings && ts.isNamespaceImport(bindings),
        named:
          bindings && ts.isNamedImports(bindings)
            ? bindings.elements.map((e) => ({
                imported: (e.propertyName ?? e.name).text,
                local: e.name.text,
                typeOnly: e.isTypeOnly,
              }))
            : [],
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const clause = node.exportClause;
      add('export', node, node.moduleSpecifier, {
        typeOnly: node.isTypeOnly,
        namespace: clause && ts.isNamespaceExport(clause) ? clause.name.text : null,
        star: !clause || ts.isNamespaceExport(clause),
        named:
          clause && ts.isNamedExports(clause)
            ? clause.elements.map((e) => ({
                imported: (e.propertyName ?? e.name).text,
                local: e.name.text,
                typeOnly: e.isTypeOnly,
              }))
            : [],
      });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      add('importEquals', node, node.moduleReference.expression, { typeOnly: node.isTypeOnly });
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const specifier = node.arguments[0];
      const callee = dottedCallee(node.expression);
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add('dynamic', node, specifier);
      else if (ts.isIdentifier(node.expression) && node.expression.text === 'require')
        add('require', node, specifier);
      else if (callee && MOCK_CALLEES.has(callee)) add('mock', node, specifier, { callee });
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      add('importType', node, node.argument.literal, { typeOnly: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

/** Every place a parsed file names a module, in source order; `kinds` narrows it. Read once per parse. */
export function moduleImports(
  sourceFile: ts.SourceFile,
  kinds?: readonly ImportKind[],
): readonly ModuleImport[] {
  let all = read.get(sourceFile);
  if (!all) {
    all = readImports(sourceFile);
    read.set(sourceFile, all);
  }
  return kinds ? all.filter((site) => kinds.includes(site.kind)) : all;
}

/** Every `import … from '…'` and `export … from '…'` statement: a side-effect import names no binding and is left out. */
export const fromStatements = (sourceFile: ts.SourceFile): readonly ModuleImport[] =>
  moduleImports(sourceFile, ['import', 'export']).filter((site) => !site.sideEffect);

/** True when `spec` is `name` itself or one of its subpaths. */
export const namesModule = (spec: string, name: string): boolean =>
  spec === name || spec.startsWith(`${name}/`);
