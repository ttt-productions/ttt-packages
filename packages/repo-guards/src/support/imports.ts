import ts from 'typescript';

export type ImportKind =
  'import' | 'export' | 'importEquals' | 'dynamic' | 'require' | 'mock' | 'importType';

export const MODULE_LOADS: readonly ImportKind[] = Object.freeze([
  'import',
  'export',
  'importEquals',
  'dynamic',
  'require',
]);

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

export interface ImportedName {
  imported: string;
  local: string;
  typeOnly: boolean;
}

export interface ModuleImport {
  spec: string;
  kind: ImportKind;
  node: ts.Node;
  specifier: ts.StringLiteralLike;
  topLevel: boolean;
  typeOnly: boolean;
  sideEffect: boolean;
  defaultName: string | null;
  namespace: string | null;
  star: boolean;
  named: readonly ImportedName[];
  callee: string | null;
  byImport: boolean;
}

// `vi.mock(import('x'), …)` names its module through an import() the runner never evaluates.
function importedModuleOf(argument: ts.Expression | undefined): ts.StringLiteralLike | null {
  if (!argument || !ts.isCallExpression(argument)) return null;
  if (argument.expression.kind !== ts.SyntaxKind.ImportKeyword) return null;
  const [spec] = argument.arguments;
  return spec && ts.isStringLiteralLike(spec) ? spec : null;
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
      byImport: false,
      ...rest,
    });
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = dottedCallee(node.expression);
      const imported = importedModuleOf(node.arguments[0]);
      if (callee && MOCK_CALLEES.has(callee) && imported) {
        add('mock', node, imported, { callee, byImport: true });
        node.arguments.slice(1).forEach(visit);
        return;
      }
    }
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

export const fromStatements = (sourceFile: ts.SourceFile): readonly ModuleImport[] =>
  moduleImports(sourceFile, ['import', 'export']).filter((site) => !site.sideEffect);

export const namesModule = (spec: string, name: string): boolean =>
  spec === name || spec.startsWith(`${name}/`);
