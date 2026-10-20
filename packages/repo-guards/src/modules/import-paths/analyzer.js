// The import-path guard: every definition has exactly one import path.
//
// Four structural facts, checked over an app's module set held in memory:
//
//   1. A module that is not a folder `index` never re-exports — value or type, named, aliased,
//      star, or the two-statement `import { x } …; export { x }`. Its consumers import the owner.
//   2. A folder `index` forwards only modules inside its own folder's subtree — never a module
//      outside it, never a package.
//   3. Code outside a folder that has an `index` imports through that index, never past it. A test
//      may import a file inside the folder only for names the index does not forward from it. A
//      test's module mocks (`vi.mock` and kin) name the path the code under test imports, so they
//      are never held to this.
//   4. Code inside a folder never imports the `index` of a folder that contains it — it imports its
//      siblings directly, so a folder entry point can never import itself in a cycle.
//
// An exception (a framework entry module such as a deploy manifest) may re-export and is not a
// folder entry point. Each one carries a justification, and one that stops re-exporting is stale.
//
// Whether an index member is still imported by anything outside its folder is a usage question,
// not a boundary, so it is a separate report (`findUnusedIndexMembers`), never a violation.

import ts from 'typescript';
import { moduleImports } from '../../support/imports.js';
import { reviewedProblems } from '../../support/facts.js';
import { dirnameOf, normalizePath } from '../../support/paths.js';
import { isUnder } from '../../support/text.js';

/** Every violation kind the guard reports. */
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
const EMITTED_TO_SOURCE = Object.freeze({
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
});

const extensionOf = (p) => {
  const base = p.slice(p.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot);
};

const defaultIsTestFile = (p) =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || p.split('/').includes('__tests__');

/**
 * Everything the guard knows about one app.
 *
 * @param {{
 *   importAliases?: Record<string, string>,
 *   exceptions?: Array<{ file: string, why: string }>,
 *   codeExtensions?: string[],
 *   isTestFile?: (path: string) => boolean,
 *   isExcludedModule?: (path: string) => boolean,
 * }} [options]
 *   `importAliases` maps a specifier prefix to a repo-relative folder (`{ '@/': 'src/' }`).
 *   `exceptions` names the framework entry modules that may re-export; every one needs a `why`.
 *   `isTestFile` decides which modules are tests (default: a `.test.` / `.spec.` name, or any
 *   `__tests__` folder on the path).
 *   `isExcludedModule` says whether a module file exists inside a path the analyzed set leaves out
 *   on purpose; an import of one resolves without being judged, the way a package import does.
 */
export function createImportPathProfile({
  importAliases = {},
  exceptions = [],
  codeExtensions = DEFAULT_CODE_EXTENSIONS,
  isTestFile = defaultIsTestFile,
  isExcludedModule = () => false,
} = {}) {
  const problems = [];
  reviewedProblems(exceptions, 'exceptions', problems, { key: 'file' });
  if (problems.length)
    throw new Error(
      `repo-guards: the import-path exceptions are malformed: ${problems.join('; ')}`,
    );
  for (const [prefix, target] of Object.entries(importAliases)) {
    if (!prefix || typeof target !== 'string') {
      throw new Error(`repo-guards: alias ${JSON.stringify(prefix)} needs a target folder`);
    }
  }
  return Object.freeze({
    importAliases: Object.freeze({ ...importAliases }),
    exceptions: Object.freeze(exceptions.map((e) => Object.freeze({ file: e.file, why: e.why }))),
    codeExtensions: Object.freeze([...codeExtensions]),
    isTestFile,
    isExcludedModule,
  });
}

function scriptKindOf(path) {
  const ext = extensionOf(path);
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const hasExportModifier = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const hasDefaultModifier = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

/** The names a dynamic import or `require` reads, when the code says; `'*'` when it does not. */
function namesReadFromCall(call) {
  let node = call;
  if (ts.isAwaitExpression(node.parent)) node = node.parent;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  if (
    ts.isVariableDeclaration(parent) &&
    parent.initializer === node &&
    ts.isObjectBindingPattern(parent.name)
  ) {
    const names = [];
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

const isClassExtends = (node) =>
  ts.isHeritageClause(node.parent) &&
  node.parent.token === ts.SyntaxKind.ExtendsKeyword &&
  (ts.isClassDeclaration(node.parent.parent) || ts.isClassExpression(node.parent.parent));

/** A declaration's own name, or a property name read off an object — never a reference to a binding. */
function isNameNotReference(node) {
  const p = node.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) || ts.isQualifiedName(p))
    return p.name === node || p.right === node;
  return (
    (ts.isPropertyAssignment(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isGetAccessorDeclaration(p) ||
      ts.isSetAccessorDeclaration(p) ||
      ts.isEnumMember(p) ||
      ts.isBindingElement(p) ||
      ts.isLabeledStatement(p) ||
      ts.isJsxAttribute(p)) &&
    p.name === node
  );
}

/**
 * Every name the module reads as a value. An imported binding read only in type positions is erased
 * by the build, so its import loads nothing at run time.
 */
function valueReferencedNames(sf) {
  const used = new Set();
  const visit = (node) => {
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

/**
 * One module's import edges, re-exports, and exported names. An edge is `typeOnly` when the build
 * erases it: written type-only, or binding only names the module reads in type positions.
 *
 * @param {string} path repo-relative, forward-slashed
 * @param {string} text
 * @param {import('typescript').SourceFile | null} [sourceFile] the file already parsed
 */
export function parseModule(path, text, sourceFile = null) {
  // A module the reader already parsed is never parsed a second time.
  const sf =
    sourceFile ?? ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindOf(path));
  /** @type {Array<{ spec: string, kind: 'static' | 'dynamic' | 'mock' | 'export-from', names: string[] | '*', typeOnly: boolean }>} */
  const imports = [];
  let valueNames = null;
  const readAsValue = (local) => (valueNames ??= valueReferencedNames(sf)).has(local);
  /** @type {Array<{ spec: string, name: string, imported: string, form: 'named' | 'aliased' | 'star' | 'namespace' | 'two-statement' }>} */
  const reExports = [];
  /** Names this module exports from its own declarations (not forwards). */
  const ownExports = new Set();
  const importedBindings = new Map();

  const sites = moduleImports(sf);
  for (const site of sites) {
    if (!site.topLevel) continue;
    const { spec } = site;
    if (site.kind === 'import') {
      const names = [];
      const valueLocals = [];
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
        const add = (name) => {
          if (ts.isIdentifier(name)) ownExports.add(name.text);
          else for (const el of name.elements) if (ts.isBindingElement(el)) add(el.name);
        };
        for (const d of stmt.declarationList.declarations) add(d.name);
      } else if (hasDefaultModifier(stmt)) {
        ownExports.add('default');
      } else if (stmt.name && (ts.isIdentifier(stmt.name) || ts.isStringLiteral(stmt.name))) {
        ownExports.add(stmt.name.text);
      }
    }
  }

  for (const { kind, node, spec } of sites) {
    if (kind === 'dynamic' || kind === 'require')
      imports.push({ spec, kind: 'dynamic', names: namesReadFromCall(node), typeOnly: false });
    else if (kind === 'mock') imports.push({ spec, kind: 'mock', names: '*', typeOnly: false });
    else if (kind === 'importType') {
      const q = node.qualifier;
      const first = q
        ? ts.isIdentifier(q)
          ? q.text
          : q.left && ts.isIdentifier(q.left)
            ? q.left.text
            : null
        : null;
      imports.push({ spec, kind: 'static', names: first ? [first] : '*', typeOnly: true });
    }
  }

  return { imports, reExports, ownExports };
}

function isIndexFile(path, profile) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const ext = extensionOf(base);
  return (
    base.slice(0, base.length - ext.length) === 'index' && profile.codeExtensions.includes(ext)
  );
}

/** Under a folder, the repository root (`''`) holding everything. */
const within = (path, dir) => dir === '' || isUnder(path, dir);

/**
 * The guard over an in-memory module set.
 *
 * @param {{ files: Map<string, string | { text: string, sourceFile: import('typescript').SourceFile }>, roots: string[], profile: ReturnType<typeof createImportPathProfile> }} input
 *   `files` maps every analyzed module (repo-relative, forward-slashed) to its text; `roots` are the
 *   analyzed folders. A local specifier that resolves under a root to no analyzed module is
 *   `unresolved-import` — the guard never treats a path it cannot read as clean — unless the
 *   profile's `isExcludedModule` says the module exists inside a path left out on purpose.
 */
export function analyzeImportPaths({ files, roots, profile }) {
  if (!profile) throw new Error('repo-guards: analyzeImportPaths needs a profile');
  if (!Array.isArray(roots) || roots.length === 0)
    throw new Error('repo-guards: analyzeImportPaths needs its roots');
  const model = buildModel(files, roots, profile);
  const violations = [];
  const add = (kind, file, detail) => violations.push({ kind, file, detail });

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
      if (target.kind === 'unresolved') continue; // reported once, on the import edge below
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
      // A non-index forward is already a violation above; an exception's forwards are allowed. An
      // index's own forward still may not reach past a nested folder's index.
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

/**
 * Report-only: index members no module outside the index's folder imports. Never a violation —
 * whether a member is used is a usage question, not a boundary.
 */
export function findUnusedIndexMembers({ files, roots, profile }) {
  const model = buildModel(files, roots, profile);
  const used = new Map();
  for (const indexPath of model.indexDirs.values()) used.set(indexPath, new Set());
  for (const [path, mod] of model.modules) {
    for (const edge of mod.parsed.imports) {
      if (edge.kind === 'mock') continue;
      const target = model.resolve(path, edge.spec);
      if (target.kind !== 'file' || !used.has(target.path)) continue;
      if (within(path, dirnameOf(target.path))) continue;
      const set = used.get(target.path);
      if (edge.names === '*') set.add('*');
      else for (const n of edge.names) set.add(n);
    }
  }
  const report = [];
  for (const [indexPath, set] of used) {
    if (set.has('*')) continue;
    const unused = [...model.exportedNames(indexPath)].filter((n) => !set.has(n)).sort();
    if (unused.length) report.push({ file: indexPath, unused });
  }
  return report.sort((a, b) => (a.file < b.file ? -1 : 1));
}

/** The one kind of test that may import an entry index: one that proves the entry forwards a name. */
const ENTRY_SURFACE_TEST = /\.entry\.(test|spec)\.[cm]?[jt]sx?$/;

// The extension a module's built file carries, which is the one a relative specifier names it by.
const BUILT_EXTENSION = Object.freeze({
  '.ts': '.js',
  '.tsx': '.js',
  '.js': '.js',
  '.jsx': '.jsx',
  '.mts': '.mjs',
  '.mjs': '.mjs',
  '.cts': '.cjs',
  '.cjs': '.cjs',
});

const isRelative = (spec) =>
  spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../');

/** The specifier that names `targetPath` by its built file, written the way `spec` reaches it. */
function specifierWithExtension(spec, targetPath) {
  const built = BUILT_EXTENSION[extensionOf(targetPath)];
  const targetBase = targetPath.slice(targetPath.lastIndexOf('/') + 1);
  const stem = targetBase.slice(0, targetBase.length - extensionOf(targetBase).length);
  const trimmed = spec.replace(/\/$/, '');
  const specBase = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  // A specifier naming a folder reaches its index; one naming a file carries the file's stem.
  if (stem === 'index' && specBase !== 'index' && extensionOf(specBase) === '')
    return `${trimmed}/index${built}`;
  const specExt = extensionOf(specBase);
  return `${specExt ? trimmed.slice(0, -specExt.length) : trimmed}${built}`;
}

/**
 * The import rules inside one package, over its module set:
 *
 *   1. Code imports the file that defines each name — never an index (a folder's, a nested
 *      entry's, or the package root's) and never the package's own name. A test does the same,
 *      except an entry-surface test (`<name>.entry.test.ts`), which may import an entry index.
 *   2. Only an entry index re-exports, and only files inside its own folder, each named directly
 *      (never through another index). An index declares nothing of its own, and an `index` that is
 *      not a package entry does not exist.
 *   3. Every relative specifier names its file with the file's built extension — `./x.js` for
 *      `x.ts` or `x.tsx`, `./folder/index.js` for a folder — in source and tests alike: a static
 *      import or `export … from`, an `import()`, and a test runner's module mock.
 *
 * @param {{
 *   files: Map<string, string | { text: string, sourceFile: import('typescript').SourceFile }>,
 *   packageRoot: string,
 *   packageName: string,
 *   entryFiles: string[],
 *   profile: ReturnType<typeof createImportPathProfile>,
 * }} input
 *   `packageRoot` is the package's repo-relative folder; `entryFiles` are the source modules its
 *   `exports` are built from.
 */
export function analyzePackageImports({ files, packageRoot, packageName, entryFiles, profile }) {
  if (!profile) throw new Error('repo-guards: analyzePackageImports needs a profile');
  const model = buildModel(files, [packageRoot], profile);
  const entries = new Set(entryFiles);
  const source = `${packageRoot}/src`;
  const violations = [];
  const add = (kind, file, detail) => violations.push({ kind, file, detail });
  const ownName = (spec) => spec === packageName || spec.startsWith(`${packageName}/`);
  // Only the package's own code has indexes the rules govern; an index a test fixture holds models
  // another package's entry.
  const packageIndex = (p) => isIndexFile(p, profile) && within(p, source);

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

    const forwardedSpecs = new Set();
    for (const re of mod.parsed.reExports) {
      forwardedSpecs.add(re.spec);
      const shown =
        re.form === 'star'
          ? `* from '${re.spec}'`
          : `${re.imported === re.name ? re.name : `${re.imported} as ${re.name}`} from '${re.spec}'`;
      if (!entryIndex) {
        // A non-entry index is reported once, as itself: deleting it removes its forwards too.
        if (!indexFile)
          add(
            'reexport-outside-entry',
            path,
            `${re.form} re-export of ${shown} — only an entry index re-exports`,
          );
        continue;
      }
      const target = model.resolve(path, re.spec);
      if (target.kind === 'unresolved') continue; // reported once, on the import edge below
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
      // A forward is judged as a re-export above.
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

/**
 * Every runtime import cycle among a module set: the strongly connected groups of its static
 * imports and forwards, type-only edges and lazy `import()` left out (neither runs while a module
 * evaluates). Each cycle is reported once, as one closed path through it.
 *
 * @param {{ files: Map<string, string | { text: string, sourceFile: import('typescript').SourceFile }>, roots: string[], profile: ReturnType<typeof createImportPathProfile> }} input
 */
export function findImportCycles({ files, roots, profile }) {
  const model = buildModel(files, roots, profile);
  const edges = new Map();
  for (const [path, mod] of model.modules) {
    const out = new Set();
    for (const edge of mod.parsed.imports) {
      if (edge.typeOnly || (edge.kind !== 'static' && edge.kind !== 'export-from')) continue;
      const target = model.resolve(path, edge.spec);
      if (target.kind === 'file') out.add(target.path);
    }
    edges.set(path, [...out].sort());
  }

  // Tarjan's strongly connected components, iterative so a deep import chain cannot overflow.
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const groups = [];
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
          low.set(frame.node, Math.min(low.get(frame.node), index.get(target)));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1].node;
        low.set(parent, Math.min(low.get(parent), low.get(frame.node)));
      }
      if (low.get(frame.node) === index.get(frame.node)) {
        const group = [];
        let member;
        do {
          member = stack.pop();
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
      // The shortest way back to the group's first module, through the group alone.
      const previous = new Map([[first, null]]);
      const queue = [first];
      let closing = null;
      while (queue.length && !closing) {
        const node = queue.shift();
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
      const path = [];
      for (let node = closing; node !== null; node = previous.get(node)) path.unshift(node);
      return { file: first, modules: group, path: [...path, first] };
    })
    .sort((a, b) => (a.file < b.file ? -1 : 1));
}

function buildModel(files, roots, profile) {
  const modules = new Map();
  // A module's entry is its text, or the reader's view of it ({ text, sourceFile }).
  for (const [path, entry] of files) {
    modules.set(path, {
      parsed:
        typeof entry === 'string'
          ? parseModule(path, entry)
          : parseModule(path, entry.text, entry.sourceFile),
    });
  }
  const exceptionFiles = new Set(profile.exceptions.map((e) => e.file));
  /** folder → its index module (exceptions are not folder entry points). */
  const indexDirs = new Map();
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

  const resolveCache = new Map();
  function resolve(from, spec) {
    const key = `${from}\0${spec}`;
    if (resolveCache.has(key)) return resolveCache.get(key);
    let base = null;
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
    let result;
    if (base === null) {
      result = { kind: 'package' };
    } else {
      const found = findModule(base);
      if (found) result = { kind: 'file', path: found };
      else if (moduleCandidates(base).some(profile.isExcludedModule)) result = { kind: 'excluded' };
      else {
        const ext = extensionOf(base);
        if (ext && !profile.codeExtensions.includes(ext)) result = { kind: 'asset' };
        else if (normalizedRoots.some((r) => within(base, r) || base === r))
          result = { kind: 'unresolved', base };
        else result = { kind: 'outside' };
      }
    }
    resolveCache.set(key, result);
    return result;
  }
  /** Every module file a specifier's resolved base may name, in the order they are tried. */
  function moduleCandidates(base) {
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
  function findModule(base) {
    return moduleCandidates(base).find((candidate) => modules.has(candidate)) ?? null;
  }

  /** Every index whose folder holds `target` but not `from`, innermost first; `target` is never its own crossing. */
  function indexesCrossed(from, target) {
    const out = [];
    for (let dir = dirnameOf(target); ; dir = dirnameOf(dir)) {
      const indexPath = indexDirs.get(dir);
      if (indexPath && !within(from, dir) && indexPath !== target) out.push(indexPath);
      if (within(from, dir) || dir === '') break;
    }
    return out;
  }
  /** The folder whose index `target` is, when that folder also contains `from`. */
  function ownIndexCrossing(from, target) {
    const dir = dirnameOf(target);
    return indexDirs.get(dir) === target && within(from, dir) && from !== target ? dir : null;
  }

  const exportCache = new Map();
  /** Every name `path` exports, its forwards followed. */
  function exportedNames(path, seen = new Set()) {
    if (exportCache.has(path)) return exportCache.get(path);
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

  /** Does `indexPath` forward, directly or through a nested index, any of `names` defined in `target`? */
  function forwardsFrom(indexPath, target, names, seen = new Set()) {
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

/** A printable report of `analyzeImportPaths`' result. */
export function formatImportPathReport({ violations }) {
  if (!violations.length) return 'import-path guard: clean — every definition has one import path.';
  const lines = [`import-path guard: ${violations.length} violation(s)`];
  for (const v of violations) lines.push(`  [${v.kind}] ${v.file} — ${v.detail}`);
  return lines.join('\n');
}
