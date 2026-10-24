import ts from 'typescript';
import { moduleImports } from '../../support/imports.js';
import { reviewedProblems } from '../../support/facts.js';
import { dirnameOf, normalizePath } from '../../support/paths.js';
import { isUnder } from '../../support/text.js';

export const IMPORT_PATH_VIOLATION_KINDS = Object.freeze([
  'reexport-outside-index',
  'index-forwards-outside-folder',
  'import-past-index',
  'import-through-own-index',
  'unresolved-import',
  'stale-exception',
  'stale-exclusion',
]);

const DEFAULT_CODE_EXTENSIONS = Object.freeze([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);
// TypeScript's ESM convention writes the emitted extension in the specifier: `./x.js` names `x.ts`.
const EMITTED_TO_SOURCE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
});

const extensionOf = (p: string): string => {
  const base = p.slice(p.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot);
};

const defaultIsTestFile = (p: string): boolean =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || p.split('/').includes('__tests__');

export interface ImportPathProfile {
  readonly importAliases: Readonly<Record<string, string>>;
  readonly exceptions: ReadonlyArray<Readonly<{ file: string; why: string }>>;
  readonly codeExtensions: readonly string[];
  readonly isTestFile: (path: string) => boolean;
  readonly isExcludedModule: (path: string) => boolean;
}

export type ImportNames = string[] | '*';

export interface ImportEdge {
  spec: string;
  kind: 'static' | 'dynamic' | 'mock' | 'export-from';
  names: ImportNames;
  typeOnly: boolean;
}

export interface ReExport {
  spec: string;
  name: string;
  imported: string;
  form: 'named' | 'aliased' | 'star' | 'namespace' | 'two-statement';
}

export interface ParsedModule {
  imports: ImportEdge[];
  reExports: ReExport[];
  ownExports: Set<string>;
}

export type ModuleSource = string | { text: string; sourceFile: ts.SourceFile };

export interface ImportPathViolation {
  kind: string;
  file: string;
  detail: string;
}

type Resolution =
  | { kind: 'package' }
  | { kind: 'file'; path: string }
  | { kind: 'excluded' }
  | { kind: 'asset' }
  | { kind: 'unresolved'; base: string }
  | { kind: 'outside' };

interface ModelInput {
  files: ReadonlyMap<string, ModuleSource>;
  roots: readonly string[];
  profile: ImportPathProfile;
}

export function createImportPathProfile({
  importAliases = {},
  exceptions = [],
  codeExtensions = DEFAULT_CODE_EXTENSIONS,
  isTestFile = defaultIsTestFile,
  isExcludedModule = () => false,
}: {
  importAliases?: Record<string, string>;
  exceptions?: ReadonlyArray<{ file: string; why: string }>;
  codeExtensions?: readonly string[];
  isTestFile?: (path: string) => boolean;
  isExcludedModule?: (path: string) => boolean;
} = {}): ImportPathProfile {
  const problems: string[] = [];
  reviewedProblems(exceptions, 'exceptions', problems, { key: 'file' });
  if (problems.length)
    throw new Error(
      `repo-guards: the import-path exceptions are malformed: ${problems.join('; ')}`,
    );
  if (Object.keys(importAliases).some((prefix) => !prefix))
    throw new Error('repo-guards: an import alias needs a prefix');
  return Object.freeze({
    importAliases: Object.freeze({ ...importAliases }),
    exceptions: Object.freeze(exceptions.map((e) => Object.freeze({ file: e.file, why: e.why }))),
    codeExtensions: Object.freeze([...codeExtensions]),
    isTestFile,
    isExcludedModule,
  });
}

function scriptKindOf(path: string): ts.ScriptKind {
  const ext = extensionOf(path);
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const hasDefaultModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

function namesReadFromCall(call: ts.Node): ImportNames {
  let node = call;
  if (ts.isAwaitExpression(node.parent)) node = node.parent;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  if (
    ts.isVariableDeclaration(parent) &&
    parent.initializer === node &&
    ts.isObjectBindingPattern(parent.name)
  ) {
    const names: string[] = [];
    for (const el of parent.name.elements) {
      if (el.dotDotDotToken) return '*';
      const key = el.propertyName ?? el.name;
      if (!ts.isIdentifier(key) && !ts.isStringLiteral(key)) return '*';
      names.push(key.text);
    }
    return names;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node)
    return [parent.name.text];
  return '*';
}

const isClassExtends = (node: ts.ExpressionWithTypeArguments): boolean =>
  ts.isHeritageClause(node.parent) &&
  node.parent.token === ts.SyntaxKind.ExtendsKeyword &&
  (ts.isClassDeclaration(node.parent.parent) || ts.isClassExpression(node.parent.parent));

function isNameNotReference(node: ts.Identifier): boolean {
  const p = node.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p)) return p.name === node;
  if (ts.isQualifiedName(p)) return p.right === node;
  if (ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p))
    return p.label === node;
  return (
    (ts.isPropertyAssignment(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isGetAccessorDeclaration(p) ||
      ts.isSetAccessorDeclaration(p) ||
      ts.isEnumMember(p) ||
      ts.isBindingElement(p) ||
      ts.isJsxAttribute(p)) &&
    p.name === node
  );
}

function valueReferencedNames(sf: ts.SourceFile): Set<string> {
  const used = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return;
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isExpressionWithTypeArguments(node)) {
      if (isClassExtends(node)) visit(node.expression);
      return;
    }
    if (ts.isTypeNode(node)) return;
    if (ts.isExportDeclaration(node)) {
      if (
        node.isTypeOnly ||
        node.moduleSpecifier ||
        !node.exportClause ||
        !ts.isNamedExports(node.exportClause)
      )
        return;
      for (const el of node.exportClause.elements)
        if (!el.isTypeOnly) used.add((el.propertyName ?? el.name).text);
      return;
    }
    if (ts.isIdentifier(node)) {
      if (!isNameNotReference(node)) used.add(node.text);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return used;
}

const declarationName = (stmt: ts.Statement): ts.Node | undefined =>
  ts.isFunctionDeclaration(stmt) ||
  ts.isClassDeclaration(stmt) ||
  ts.isInterfaceDeclaration(stmt) ||
  ts.isTypeAliasDeclaration(stmt) ||
  ts.isEnumDeclaration(stmt) ||
  ts.isModuleDeclaration(stmt) ||
  ts.isImportEqualsDeclaration(stmt)
    ? stmt.name
    : undefined;

export function parseModule(
  path: string,
  text: string,
  sourceFile: ts.SourceFile | null = null,
): ParsedModule {
  const sf =
    sourceFile ?? ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindOf(path));
  const imports: ImportEdge[] = [];
  let valueNames: Set<string> | null = null;
  const readAsValue = (local: string) => (valueNames ??= valueReferencedNames(sf)).has(local);
  const reExports: ReExport[] = [];
  const ownExports = new Set<string>();
  const importedBindings = new Map<string, { spec: string; imported: string }>();

  const sites = moduleImports(sf);
  for (const site of sites) {
    if (!site.topLevel) continue;
    const { spec } = site;
    if (site.kind === 'import') {
      const names: string[] = [];
      const valueLocals: string[] = [];
      if (site.defaultName) {
        names.push('default');
        importedBindings.set(site.defaultName, { spec, imported: 'default' });
        valueLocals.push(site.defaultName);
      }
      if (site.namespace) {
        importedBindings.set(site.namespace, { spec, imported: '*' });
        valueLocals.push(site.namespace);
      }
      for (const { imported, local, typeOnly } of site.named) {
        names.push(imported);
        importedBindings.set(local, { spec, imported });
        if (!typeOnly) valueLocals.push(local);
      }
      const typeOnly = site.typeOnly || (!site.sideEffect && !valueLocals.some(readAsValue));
      imports.push({ spec, kind: 'static', names: site.namespace ? '*' : names, typeOnly });
    } else if (site.kind === 'importEquals') {
      imports.push({ spec, kind: 'static', names: '*', typeOnly: site.typeOnly });
    }
  }

  const exportFrom = new Map(
    sites
      .filter((site) => site.kind === 'export' && site.topLevel)
      .map((site) => [site.node, site]),
  );
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      const site = exportFrom.get(stmt);
      const clause = stmt.exportClause;
      if (site) {
        const { spec } = site;
        if (site.star) {
          reExports.push(
            site.namespace
              ? { spec, name: site.namespace, imported: '*', form: 'namespace' }
              : { spec, name: '*', imported: '*', form: 'star' },
          );
          imports.push({ spec, kind: 'export-from', names: '*', typeOnly: site.typeOnly });
        } else {
          for (const { imported, local } of site.named) {
            reExports.push({
              spec,
              name: local,
              imported,
              form: imported === local ? 'named' : 'aliased',
            });
          }
          const typeOnly =
            site.typeOnly || (site.named.length > 0 && site.named.every((n) => n.typeOnly));
          imports.push({
            spec,
            kind: 'export-from',
            names: site.named.map((n) => n.imported),
            typeOnly,
          });
        }
      } else if (clause && ts.isNamedExports(clause)) {
        for (const el of clause.elements) {
          const local = (el.propertyName ?? el.name).text;
          const binding = importedBindings.get(local);
          if (binding) {
            reExports.push({
              spec: binding.spec,
              name: el.name.text,
              imported: binding.imported,
              form: 'two-statement',
            });
          } else {
            ownExports.add(el.name.text);
          }
        }
      }
    } else if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      const expr = stmt.expression;
      const binding = ts.isIdentifier(expr) ? importedBindings.get(expr.text) : undefined;
      if (binding)
        reExports.push({
          spec: binding.spec,
          name: 'default',
          imported: binding.imported,
          form: 'two-statement',
        });
      else ownExports.add('default');
    } else if (hasExportModifier(stmt)) {
      if (ts.isVariableStatement(stmt)) {
        const add = (name: ts.BindingName): void => {
          if (ts.isIdentifier(name)) ownExports.add(name.text);
          else for (const el of name.elements) if (ts.isBindingElement(el)) add(el.name);
        };
        for (const d of stmt.declarationList.declarations) add(d.name);
      } else if (hasDefaultModifier(stmt)) {
        ownExports.add('default');
      } else {
        const name = declarationName(stmt);
        if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) ownExports.add(name.text);
      }
    }
  }

  for (const { kind, node, spec } of sites) {
    if (kind === 'dynamic' || kind === 'require')
      imports.push({ spec, kind: 'dynamic', names: namesReadFromCall(node), typeOnly: false });
    else if (kind === 'mock') imports.push({ spec, kind: 'mock', names: '*', typeOnly: false });
    else if (kind === 'importType' && ts.isImportTypeNode(node)) {
      const q = node.qualifier;
      const first = q
        ? ts.isIdentifier(q)
          ? q.text
          : ts.isIdentifier(q.left)
            ? q.left.text
            : null
        : null;
      imports.push({ spec, kind: 'static', names: first ? [first] : '*', typeOnly: true });
    }
  }

  return { imports, reExports, ownExports };
}

function isIndexFile(path: string, profile: ImportPathProfile): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const ext = extensionOf(base);
  return (
    base.slice(0, base.length - ext.length) === 'index' && profile.codeExtensions.includes(ext)
  );
}

const within = (path: string, dir: string): boolean => dir === '' || isUnder(path, dir);

export function analyzeImportPaths({ files, roots, profile }: ModelInput): {
  violations: ImportPathViolation[];
  stats: { modules: number; indexes: number };
} {
  if (!profile) throw new Error('repo-guards: analyzeImportPaths needs a profile');
  if (!Array.isArray(roots) || roots.length === 0)
    throw new Error('repo-guards: analyzeImportPaths needs its roots');
  const model = buildModel(files, roots, profile);
  const violations: ImportPathViolation[] = [];
  const add = (kind: string, file: string, detail: string) =>
    violations.push({ kind, file, detail });

  for (const exception of profile.exceptions) {
    const mod = model.modules.get(exception.file);
    if (!mod)
      add(
        'stale-exception',
        exception.file,
        'the exception names a module that is not in the analyzed trees',
      );
    else if (mod.parsed.reExports.length === 0)
      add(
        'stale-exception',
        exception.file,
        'the exception names a module that no longer re-exports anything',
      );
  }

  for (const [path, mod] of model.modules) {
    const exception = model.exceptionFiles.has(path);
    const index = model.indexDirs.get(dirnameOf(path)) === path;

    for (const re of mod.parsed.reExports) {
      const target = model.resolve(path, re.spec);
      if (target.kind === 'unresolved') continue;
      if (exception) continue;
      const shown =
        re.form === 'star'
          ? `* from '${re.spec}'`
          : `${re.imported === re.name ? re.name : `${re.imported} as ${re.name}`} from '${re.spec}'`;
      if (!index) {
        add('reexport-outside-index', path, `${re.form} re-export of ${shown}`);
      } else if (target.kind === 'excluded') {
        continue;
      } else if (target.kind !== 'file' || !within(target.path, dirnameOf(path))) {
        add(
          'index-forwards-outside-folder',
          path,
          `forwards ${shown}, which is outside ${dirnameOf(path) || 'the repo root'}/`,
        );
      }
    }

    const test = profile.isTestFile(path);
    for (const edge of mod.parsed.imports) {
      const target = model.resolve(path, edge.spec);
      if (target.kind === 'unresolved') {
        add(
          'unresolved-import',
          path,
          `'${edge.spec}' names no module under the analyzed trees (looked for ${target.base})`,
        );
        continue;
      }
      if (target.kind !== 'file' || target.path === path) continue;

      const own = model.ownIndexCrossing(path, target.path);
      if (own) {
        add(
          'import-through-own-index',
          path,
          `imports '${edge.spec}', the entry point of ${own}/ which contains it — import the sibling module directly`,
        );
        continue;
      }
      if (edge.kind === 'mock' && test) continue;
      if (edge.kind === 'export-from' && (!index || exception)) continue;
      const crossed = model.indexesCrossed(path, target.path);
      if (!crossed.length) continue;
      const outer = crossed[crossed.length - 1];
      if (
        test &&
        !crossed.some((indexPath) => model.forwardsFrom(indexPath, target.path, edge.names))
      )
        continue;
      add(
        'import-past-index',
        path,
        `imports '${edge.spec}' past ${outer} — import it through that entry point`,
      );
    }
  }

  violations.sort((a, b) =>
    a.file === b.file ? (a.detail < b.detail ? -1 : 1) : a.file < b.file ? -1 : 1,
  );
  return { violations, stats: { modules: model.modules.size, indexes: model.indexDirs.size } };
}

export function findUnusedIndexMembers({
  files,
  roots,
  profile,
}: ModelInput): Array<{ file: string; unused: string[] }> {
  const model = buildModel(files, roots, profile);
  const used = new Map<string, Set<string>>();
  for (const indexPath of model.indexDirs.values()) used.set(indexPath, new Set());
  for (const [path, mod] of model.modules) {
    for (const edge of mod.parsed.imports) {
      if (edge.kind === 'mock') continue;
      const target = model.resolve(path, edge.spec);
      if (target.kind !== 'file' || !used.has(target.path)) continue;
      if (within(path, dirnameOf(target.path))) continue;
      const set = used.get(target.path)!;
      if (edge.names === '*') set.add('*');
      else for (const n of edge.names) set.add(n);
    }
  }
  const report: Array<{ file: string; unused: string[] }> = [];
  for (const [indexPath, set] of used) {
    if (set.has('*')) continue;
    const unused = [...model.exportedNames(indexPath)].filter((n) => !set.has(n)).sort();
    if (unused.length) report.push({ file: indexPath, unused });
  }
  return report.sort((a, b) => (a.file < b.file ? -1 : 1));
}

const ENTRY_SURFACE_TEST = /\.entry\.(test|spec)\.[cm]?[jt]sx?$/;

const BUILT_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  '.ts': '.js',
  '.tsx': '.js',
  '.js': '.js',
  '.jsx': '.jsx',
  '.mts': '.mjs',
  '.mjs': '.mjs',
  '.cts': '.cjs',
  '.cjs': '.cjs',
});

const isRelative = (spec: string): boolean =>
  spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../');

function specifierWithExtension(spec: string, targetPath: string): string {
  const built = BUILT_EXTENSION[extensionOf(targetPath)];
  const targetBase = targetPath.slice(targetPath.lastIndexOf('/') + 1);
  const stem = targetBase.slice(0, targetBase.length - extensionOf(targetBase).length);
  const trimmed = spec.replace(/\/$/, '');
  const specBase = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  if (stem === 'index' && specBase !== 'index' && extensionOf(specBase) === '')
    return `${trimmed}/index${built}`;
  const specExt = extensionOf(specBase);
  return `${specExt ? trimmed.slice(0, -specExt.length) : trimmed}${built}`;
}

export function analyzePackageImports({
  files,
  packageRoot,
  packageName,
  entryFiles,
  profile,
}: {
  files: ReadonlyMap<string, ModuleSource>;
  packageRoot: string;
  packageName: string;
  entryFiles: readonly string[];
  profile: ImportPathProfile;
}): { violations: ImportPathViolation[] } {
  if (!profile) throw new Error('repo-guards: analyzePackageImports needs a profile');
  const model = buildModel(files, [packageRoot], profile);
  const entries = new Set(entryFiles);
  const source = `${packageRoot}/src`;
  const violations: ImportPathViolation[] = [];
  const add = (kind: string, file: string, detail: string) =>
    violations.push({ kind, file, detail });
  const ownName = (spec: string) => spec === packageName || spec.startsWith(`${packageName}/`);
  const packageIndex = (p: string) => isIndexFile(p, profile) && within(p, source);

  for (const [path, mod] of model.modules) {
    const indexFile = packageIndex(path);
    const entryIndex = indexFile && entries.has(path);
    if (indexFile && !entryIndex) {
      add(
        'non-entry-index',
        path,
        'an index that is not a package entry — delete it and import the files it forwarded directly',
      );
    }
    if (entryIndex && mod.parsed.ownExports.size) {
      const names = [...mod.parsed.ownExports].sort().join(', ');
      add(
        'index-declares',
        path,
        `declares ${names} — an index only forwards; move each definition into a named file and forward that file`,
      );
    }

    const forwardedSpecs = new Set<string>();
    for (const re of mod.parsed.reExports) {
      forwardedSpecs.add(re.spec);
      const shown =
        re.form === 'star'
          ? `* from '${re.spec}'`
          : `${re.imported === re.name ? re.name : `${re.imported} as ${re.name}`} from '${re.spec}'`;
      if (!entryIndex) {
        if (!indexFile)
          add(
            'reexport-outside-entry',
            path,
            `${re.form} re-export of ${shown} — only an entry index re-exports`,
          );
        continue;
      }
      const target = model.resolve(path, re.spec);
      if (target.kind === 'unresolved') continue;
      if (target.kind !== 'file' || !within(target.path, dirnameOf(path))) {
        add(
          'entry-forwards-outside-folder',
          path,
          `forwards ${shown}, which is outside ${dirnameOf(path)}/`,
        );
      } else if (packageIndex(target.path)) {
        add(
          'entry-forwards-index',
          path,
          `forwards ${shown}, an index — name the file that defines it`,
        );
      }
    }

    const entrySurfaceTest = profile.isTestFile(path) && ENTRY_SURFACE_TEST.test(path);
    for (const edge of mod.parsed.imports) {
      if (ownName(edge.spec)) {
        add(
          'import-own-package-name',
          path,
          `imports '${edge.spec}', the package's own name — import the file that defines each name`,
        );
        continue;
      }
      const target = model.resolve(path, edge.spec);
      if (target.kind === 'unresolved') {
        add(
          'unresolved-import',
          path,
          `'${edge.spec}' names no module in the package (looked for ${target.base})`,
        );
        continue;
      }
      if (target.kind === 'file' && isRelative(edge.spec)) {
        const named = specifierWithExtension(edge.spec, target.path);
        if (named !== edge.spec) {
          add(
            'relative-import-without-extension',
            path,
            `imports '${edge.spec}' — a relative import names its file with its built extension: '${named}'`,
          );
        }
      }
      if (target.kind !== 'file' || target.path === path || !packageIndex(target.path)) continue;
      if (edge.kind === 'export-from' || (entryIndex && forwardedSpecs.has(edge.spec))) continue;
      if (entrySurfaceTest && entries.has(target.path)) continue;
      add(
        'import-through-index',
        path,
        `imports '${edge.spec}', an index — import the file that defines each name`,
      );
    }
  }

  violations.sort((a, b) =>
    a.file === b.file ? (a.detail < b.detail ? -1 : 1) : a.file < b.file ? -1 : 1,
  );
  return { violations };
}

export function findImportCycles({
  files,
  roots,
  profile,
}: ModelInput): Array<{ file: string; modules: string[]; path: string[] }> {
  const model = buildModel(files, roots, profile);
  const edges = new Map<string, string[]>();
  for (const [path, mod] of model.modules) {
    const out = new Set<string>();
    for (const edge of mod.parsed.imports) {
      if (edge.typeOnly || (edge.kind !== 'static' && edge.kind !== 'export-from')) continue;
      const target = model.resolve(path, edge.spec);
      if (target.kind === 'file') out.add(target.path);
    }
    edges.set(path, [...out].sort());
  }

  // Tarjan's strongly connected components, iterative so a deep import chain cannot overflow.
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const groups: string[][] = [];
  for (const start of [...edges.keys()].sort()) {
    if (index.has(start)) continue;
    const work = [{ node: start, next: 0 }];
    index.set(start, counter);
    low.set(start, counter);
    counter += 1;
    stack.push(start);
    onStack.add(start);
    while (work.length) {
      const frame = work[work.length - 1];
      const targets = edges.get(frame.node) ?? [];
      if (frame.next < targets.length) {
        const target = targets[frame.next];
        frame.next += 1;
        if (!index.has(target)) {
          index.set(target, counter);
          low.set(target, counter);
          counter += 1;
          stack.push(target);
          onStack.add(target);
          work.push({ node: target, next: 0 });
        } else if (onStack.has(target)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(target)!));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1].node;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.node)!));
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        const group: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          group.push(member);
        } while (member !== frame.node);
        if (group.length > 1 || (edges.get(frame.node) ?? []).includes(frame.node))
          groups.push(group.sort());
      }
    }
  }

  return groups
    .map((group) => {
      const members = new Set(group);
      const first = group[0];
      const previous = new Map<string, string | null>([[first, null]]);
      const queue = [first];
      let closing: string | null = null;
      while (queue.length && !closing) {
        const node = queue.shift()!;
        for (const target of edges.get(node) ?? []) {
          if (!members.has(target)) continue;
          if (target === first) {
            closing = node;
            break;
          }
          if (!previous.has(target)) {
            previous.set(target, node);
            queue.push(target);
          }
        }
      }
      const path: string[] = [];
      for (let node = closing; node !== null; node = previous.get(node)!) path.unshift(node);
      return { file: first, modules: group, path: [...path, first] };
    })
    .sort((a, b) => (a.file < b.file ? -1 : 1));
}

function buildModel(
  files: ReadonlyMap<string, ModuleSource>,
  roots: readonly string[],
  profile: ImportPathProfile,
) {
  const modules = new Map<string, { parsed: ParsedModule }>();
  for (const [path, entry] of files) {
    modules.set(path, {
      parsed:
        typeof entry === 'string'
          ? parseModule(path, entry)
          : parseModule(path, entry.text, entry.sourceFile),
    });
  }
  const exceptionFiles = new Set(profile.exceptions.map((e) => e.file));
  const indexDirs = new Map<string, string>();
  for (const path of modules.keys()) {
    if (isIndexFile(path, profile) && !exceptionFiles.has(path)) {
      const dir = dirnameOf(path);
      if (indexDirs.has(dir))
        throw new Error(
          `repo-guards: ${dir}/ has two index modules (${indexDirs.get(dir)}, ${path})`,
        );
      indexDirs.set(dir, path);
    }
  }
  const normalizedRoots = roots.map((r) => normalizePath(r).path);
  const aliases = Object.entries(profile.importAliases).sort((a, b) => b[0].length - a[0].length);

  const resolveCache = new Map<string, Resolution>();
  function resolve(from: string, spec: string): Resolution {
    const key = `${from}\0${spec}`;
    const cached = resolveCache.get(key);
    if (cached) return cached;
    let base: string | null = null;
    for (const [prefix, target] of aliases) {
      if (spec === prefix.replace(/\/$/, '') || spec.startsWith(prefix)) {
        base = normalizePath(`${target}/${spec.slice(prefix.length)}`).path;
        break;
      }
    }
    if (
      base === null &&
      (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../'))
    ) {
      base = normalizePath(`${dirnameOf(from)}/${spec}`).path;
    }
    let result: Resolution;
    if (base === null) {
      result = { kind: 'package' };
    } else {
      const found = findModule(base);
      if (found) result = { kind: 'file', path: found };
      else if (moduleCandidates(base).some(profile.isExcludedModule)) result = { kind: 'excluded' };
      else {
        const ext = extensionOf(base);
        if (ext && !profile.codeExtensions.includes(ext)) result = { kind: 'asset' };
        else if (normalizedRoots.some((r) => within(base!, r) || base === r))
          result = { kind: 'unresolved', base };
        else result = { kind: 'outside' };
      }
    }
    resolveCache.set(key, result);
    return result;
  }
  function moduleCandidates(base: string): string[] {
    const out = [base];
    const ext = extensionOf(base);
    if (EMITTED_TO_SOURCE[ext]) {
      const stem = base.slice(0, -ext.length);
      for (const src of EMITTED_TO_SOURCE[ext]) out.push(stem + src);
    }
    for (const e of profile.codeExtensions) out.push(base + e);
    for (const e of profile.codeExtensions) out.push(`${base}/index${e}`);
    return out;
  }
  function findModule(base: string): string | null {
    return moduleCandidates(base).find((candidate) => modules.has(candidate)) ?? null;
  }

  function indexesCrossed(from: string, target: string): string[] {
    const out: string[] = [];
    for (let dir = dirnameOf(target); ; dir = dirnameOf(dir)) {
      const indexPath = indexDirs.get(dir);
      if (indexPath && !within(from, dir) && indexPath !== target) out.push(indexPath);
      if (within(from, dir) || dir === '') break;
    }
    return out;
  }
  function ownIndexCrossing(from: string, target: string): string | null {
    const dir = dirnameOf(target);
    return indexDirs.get(dir) === target && within(from, dir) && from !== target ? dir : null;
  }

  const exportCache = new Map<string, Set<string>>();
  function exportedNames(path: string, seen = new Set<string>()): Set<string> {
    const cached = exportCache.get(path);
    if (cached) return cached;
    if (seen.has(path)) return new Set();
    seen.add(path);
    const mod = modules.get(path);
    const names = new Set(mod ? mod.parsed.ownExports : []);
    for (const re of mod ? mod.parsed.reExports : []) {
      if (re.form === 'star') {
        const t = resolve(path, re.spec);
        if (t.kind === 'file')
          for (const n of exportedNames(t.path, seen)) if (n !== 'default') names.add(n);
      } else names.add(re.name);
    }
    exportCache.set(path, names);
    return names;
  }

  function forwardsFrom(
    indexPath: string,
    target: string,
    names: ImportNames,
    seen = new Set<string>(),
  ): boolean {
    if (seen.has(indexPath)) return false;
    seen.add(indexPath);
    const wanted = names === '*' ? null : new Set(names);
    for (const re of modules.get(indexPath)?.parsed.reExports ?? []) {
      const t = resolve(indexPath, re.spec);
      if (t.kind !== 'file') continue;
      if (t.path === target) {
        if (!wanted || re.form === 'star' || re.form === 'namespace') {
          if (!wanted || [...wanted].some((n) => exportedNames(target).has(n))) return true;
        } else if (wanted.has(re.imported)) return true;
      } else if (indexDirs.get(dirnameOf(t.path)) === t.path && within(target, dirnameOf(t.path))) {
        if (forwardsFrom(t.path, target, names, seen)) return true;
      }
    }
    return false;
  }

  return {
    modules,
    exceptionFiles,
    indexDirs,
    resolve,
    indexesCrossed,
    ownIndexCrossing,
    exportedNames,
    forwardsFrom,
  };
}

export function formatImportPathReport({
  violations,
}: {
  violations: readonly ImportPathViolation[];
}): string {
  if (!violations.length) return 'import-path guard: clean — every definition has one import path.';
  const lines = [`import-path guard: ${violations.length} violation(s)`];
  for (const v of violations) lines.push(`  [${v.kind}] ${v.file} — ${v.detail}`);
  return lines.join('\n');
}
