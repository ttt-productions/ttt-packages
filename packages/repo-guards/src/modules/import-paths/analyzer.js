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

const DEFAULT_CODE_EXTENSIONS = Object.freeze(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
// TypeScript's ESM convention writes the emitted extension in the specifier: `./x.js` names `x.ts`.
const EMITTED_TO_SOURCE = Object.freeze({
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
});
const MOCK_CALLEES = new Set([
  'vi.mock', 'vi.doMock', 'vi.unmock', 'vi.doUnmock', 'vi.importActual', 'vi.importMock',
  'jest.mock', 'jest.doMock', 'jest.unmock', 'jest.requireActual', 'jest.requireMock',
]);

const posixDirname = (p) => {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
};

/** `a/./b/../c` → `a/c`; a path that climbs above the repo root keeps its leading `..`. */
function normalize(p) {
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..' && out.length && out[out.length - 1] !== '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

const extensionOf = (p) => {
  const base = p.slice(p.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot);
};

const defaultIsTestFile = (p) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || p.split('/').includes('__tests__');

/**
 * Everything the guard knows about one app.
 *
 * @param {{
 *   importAliases?: Record<string, string>,
 *   exceptions?: Array<{ file: string, why: string }>,
 *   codeExtensions?: string[],
 *   isTestFile?: (path: string) => boolean,
 * }} [options]
 *   `importAliases` maps a specifier prefix to a repo-relative folder (`{ '@/': 'src/' }`).
 *   `exceptions` names the framework entry modules that may re-export; every one needs a `why`.
 *   `isTestFile` decides which modules are tests (default: a `.test.` / `.spec.` name, or any
 *   `__tests__` folder on the path).
 */
export function createImportPathProfile({
  importAliases = {},
  exceptions = [],
  codeExtensions = DEFAULT_CODE_EXTENSIONS,
  isTestFile = defaultIsTestFile,
} = {}) {
  const seen = new Set();
  for (const entry of exceptions) {
    if (!entry || typeof entry.file !== 'string' || !entry.file) {
      throw new Error('repo-guards: every exception names its file');
    }
    if (typeof entry.why !== 'string' || !entry.why.trim()) {
      throw new Error(`repo-guards: exception ${entry.file} carries no justification`);
    }
    if (seen.has(entry.file)) throw new Error(`repo-guards: exception ${entry.file} is listed twice`);
    seen.add(entry.file);
  }
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
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const hasDefaultModifier = (node) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

function calleeName(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    return `${expr.expression.text}.${expr.name.text}`;
  }
  return null;
}

/** The names a dynamic import or `require` reads, when the code says; `'*'` when it does not. */
function namesReadFromCall(call) {
  let node = call;
  if (ts.isAwaitExpression(node.parent)) node = node.parent;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isObjectBindingPattern(parent.name)) {
    const names = [];
    for (const el of parent.name.elements) {
      if (el.dotDotDotToken) return '*';
      const key = el.propertyName ?? el.name;
      if (!ts.isIdentifier(key) && !ts.isStringLiteral(key)) return '*';
      names.push(key.text);
    }
    return names;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) return [parent.name.text];
  return '*';
}

/**
 * One module's import edges, re-exports, and exported names.
 *
 * @param {string} path repo-relative, forward-slashed
 * @param {string} text
 * @param {import('typescript').SourceFile | null} [sourceFile] the file already parsed
 */
export function parseModule(path, text, sourceFile = null) {
  // A module the reader already parsed is never parsed a second time.
  const sf = sourceFile ?? ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindOf(path));
  /** @type {Array<{ spec: string, kind: 'static' | 'dynamic' | 'mock' | 'export-from', names: string[] | '*' }>} */
  const imports = [];
  /** @type {Array<{ spec: string, name: string, imported: string, form: 'named' | 'aliased' | 'star' | 'namespace' | 'two-statement' }>} */
  const reExports = [];
  /** Names this module exports from its own declarations (not forwards). */
  const ownExports = new Set();
  const importedBindings = new Map();

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const spec = stmt.moduleSpecifier.text;
      const clause = stmt.importClause;
      const names = [];
      let namespace = false;
      if (clause?.name) {
        names.push('default');
        importedBindings.set(clause.name.text, { spec, imported: 'default' });
      }
      const b = clause?.namedBindings;
      if (b && ts.isNamespaceImport(b)) {
        namespace = true;
        importedBindings.set(b.name.text, { spec, imported: '*' });
      } else if (b && ts.isNamedImports(b)) {
        for (const el of b.elements) {
          const imported = (el.propertyName ?? el.name).text;
          names.push(imported);
          importedBindings.set(el.name.text, { spec, imported });
        }
      }
      imports.push({ spec, kind: 'static', names: namespace ? '*' : names });
    } else if (ts.isImportEqualsDeclaration(stmt) && ts.isExternalModuleReference(stmt.moduleReference)
      && ts.isStringLiteral(stmt.moduleReference.expression)) {
      imports.push({ spec: stmt.moduleReference.expression.text, kind: 'static', names: '*' });
    }
  }

  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      const spec = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : null;
      const clause = stmt.exportClause;
      if (spec) {
        if (!clause) {
          reExports.push({ spec, name: '*', imported: '*', form: 'star' });
          imports.push({ spec, kind: 'export-from', names: '*' });
        } else if (ts.isNamespaceExport(clause)) {
          reExports.push({ spec, name: clause.name.text, imported: '*', form: 'namespace' });
          imports.push({ spec, kind: 'export-from', names: '*' });
        } else {
          const names = [];
          for (const el of clause.elements) {
            const imported = (el.propertyName ?? el.name).text;
            names.push(imported);
            reExports.push({ spec, name: el.name.text, imported, form: el.propertyName ? 'aliased' : 'named' });
          }
          imports.push({ spec, kind: 'export-from', names });
        }
      } else if (clause && ts.isNamedExports(clause)) {
        for (const el of clause.elements) {
          const local = (el.propertyName ?? el.name).text;
          const binding = importedBindings.get(local);
          if (binding) {
            reExports.push({ spec: binding.spec, name: el.name.text, imported: binding.imported, form: 'two-statement' });
          } else {
            ownExports.add(el.name.text);
          }
        }
      }
    } else if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      const expr = stmt.expression;
      const binding = ts.isIdentifier(expr) ? importedBindings.get(expr.text) : undefined;
      if (binding) reExports.push({ spec: binding.spec, name: 'default', imported: binding.imported, form: 'two-statement' });
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

  const visit = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) {
      const spec = node.arguments[0].text;
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        imports.push({ spec, kind: 'dynamic', names: namesReadFromCall(node) });
      } else {
        const callee = calleeName(node.expression);
        if (callee === 'require') imports.push({ spec, kind: 'dynamic', names: namesReadFromCall(node) });
        else if (callee && MOCK_CALLEES.has(callee)) imports.push({ spec, kind: 'mock', names: '*' });
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      const q = node.qualifier;
      const first = q ? (ts.isIdentifier(q) ? q.text : q.left && ts.isIdentifier(q.left) ? q.left.text : null) : null;
      imports.push({ spec: node.argument.literal.text, kind: 'static', names: first ? [first] : '*' });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { imports, reExports, ownExports };
}

function isIndexFile(path, profile) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const ext = extensionOf(base);
  return base.slice(0, base.length - ext.length) === 'index' && profile.codeExtensions.includes(ext);
}

const isUnder = (path, dir) => dir === '' || path.startsWith(`${dir}/`);

/**
 * The guard over an in-memory module set.
 *
 * @param {{ files: Map<string, string | { text: string, sourceFile: import('typescript').SourceFile }>, roots: string[], profile: ReturnType<typeof createImportPathProfile> }} input
 *   `files` maps every analyzed module (repo-relative, forward-slashed) to its text; `roots` are the
 *   analyzed folders. A local specifier that resolves under a root to no analyzed module is
 *   `unresolved-import` — the guard never treats a path it cannot read as clean.
 */
export function analyzeImportPaths({ files, roots, profile }) {
  if (!profile) throw new Error('repo-guards: analyzeImportPaths needs a profile');
  if (!Array.isArray(roots) || roots.length === 0) throw new Error('repo-guards: analyzeImportPaths needs its roots');
  const model = buildModel(files, roots, profile);
  const violations = [];
  const add = (kind, file, detail) => violations.push({ kind, file, detail });

  for (const exception of profile.exceptions) {
    const mod = model.modules.get(exception.file);
    if (!mod) add('stale-exception', exception.file, 'the exception names a module that is not in the analyzed trees');
    else if (mod.parsed.reExports.length === 0) add('stale-exception', exception.file, 'the exception names a module that no longer re-exports anything');
  }

  for (const [path, mod] of model.modules) {
    const exception = model.exceptionFiles.has(path);
    const index = model.indexDirs.get(posixDirname(path)) === path;

    for (const re of mod.parsed.reExports) {
      const target = model.resolve(path, re.spec);
      if (target.kind === 'unresolved') continue; // reported once, on the import edge below
      if (exception) continue;
      const shown = re.form === 'star' ? `* from '${re.spec}'` : `${re.imported === re.name ? re.name : `${re.imported} as ${re.name}`} from '${re.spec}'`;
      if (!index) {
        add('reexport-outside-index', path, `${re.form} re-export of ${shown}`);
      } else if (target.kind !== 'file' || !isUnder(target.path, posixDirname(path))) {
        add('index-forwards-outside-folder', path, `forwards ${shown}, which is outside ${posixDirname(path) || 'the repo root'}/`);
      }
    }

    const test = profile.isTestFile(path);
    for (const edge of mod.parsed.imports) {
      const target = model.resolve(path, edge.spec);
      if (target.kind === 'unresolved') {
        add('unresolved-import', path, `'${edge.spec}' names no module under the analyzed trees (looked for ${target.base})`);
        continue;
      }
      if (target.kind !== 'file' || target.path === path) continue;

      const own = model.ownIndexCrossing(path, target.path);
      if (own) {
        add('import-through-own-index', path, `imports '${edge.spec}', the entry point of ${own}/ which contains it — import the sibling module directly`);
        continue;
      }
      if (edge.kind === 'mock' && test) continue;
      // A non-index forward is already a violation above; an exception's forwards are allowed. An
      // index's own forward still may not reach past a nested folder's index.
      if (edge.kind === 'export-from' && (!index || exception)) continue;
      const crossed = model.indexesCrossed(path, target.path);
      if (!crossed.length) continue;
      const outer = crossed[crossed.length - 1];
      if (test && !crossed.some((indexPath) => model.forwardsFrom(indexPath, target.path, edge.names))) continue;
      add('import-past-index', path, `imports '${edge.spec}' past ${outer} — import it through that entry point`);
    }
  }

  violations.sort((a, b) => (a.file === b.file ? (a.detail < b.detail ? -1 : 1) : a.file < b.file ? -1 : 1));
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
      if (isUnder(path, posixDirname(target.path))) continue;
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

function buildModel(files, roots, profile) {
  const modules = new Map();
  // A module's entry is its text, or the reader's view of it ({ text, sourceFile }).
  for (const [path, entry] of files) {
    modules.set(path, { parsed: typeof entry === 'string' ? parseModule(path, entry) : parseModule(path, entry.text, entry.sourceFile) });
  }
  const exceptionFiles = new Set(profile.exceptions.map((e) => e.file));
  /** folder → its index module (exceptions are not folder entry points). */
  const indexDirs = new Map();
  for (const path of modules.keys()) {
    if (isIndexFile(path, profile) && !exceptionFiles.has(path)) {
      const dir = posixDirname(path);
      if (indexDirs.has(dir)) throw new Error(`repo-guards: ${dir}/ has two index modules (${indexDirs.get(dir)}, ${path})`);
      indexDirs.set(dir, path);
    }
  }
  const normalizedRoots = roots.map((r) => normalize(r));
  const aliases = Object.entries(profile.importAliases).sort((a, b) => b[0].length - a[0].length);

  const resolveCache = new Map();
  function resolve(from, spec) {
    const key = `${from}\0${spec}`;
    if (resolveCache.has(key)) return resolveCache.get(key);
    let base = null;
    for (const [prefix, target] of aliases) {
      if (spec === prefix.replace(/\/$/, '') || spec.startsWith(prefix)) {
        base = normalize(`${target}/${spec.slice(prefix.length)}`);
        break;
      }
    }
    if (base === null && (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../'))) {
      base = normalize(`${posixDirname(from)}/${spec}`);
    }
    let result;
    if (base === null) {
      result = { kind: 'package' };
    } else {
      const found = findModule(base);
      if (found) result = { kind: 'file', path: found };
      else {
        const ext = extensionOf(base);
        if (ext && !profile.codeExtensions.includes(ext)) result = { kind: 'asset' };
        else if (normalizedRoots.some((r) => isUnder(base, r) || base === r)) result = { kind: 'unresolved', base };
        else result = { kind: 'outside' };
      }
    }
    resolveCache.set(key, result);
    return result;
  }
  function findModule(base) {
    if (modules.has(base)) return base;
    const ext = extensionOf(base);
    if (EMITTED_TO_SOURCE[ext]) {
      const stem = base.slice(0, -ext.length);
      for (const src of EMITTED_TO_SOURCE[ext]) if (modules.has(stem + src)) return stem + src;
    }
    for (const e of profile.codeExtensions) if (modules.has(base + e)) return base + e;
    for (const e of profile.codeExtensions) if (modules.has(`${base}/index${e}`)) return `${base}/index${e}`;
    return null;
  }

  /** Every index whose folder holds `target` but not `from`, innermost first; `target` is never its own crossing. */
  function indexesCrossed(from, target) {
    const out = [];
    for (let dir = posixDirname(target); ; dir = posixDirname(dir)) {
      const indexPath = indexDirs.get(dir);
      if (indexPath && !isUnder(from, dir) && indexPath !== target) out.push(indexPath);
      if (isUnder(from, dir) || dir === '') break;
    }
    return out;
  }
  /** The folder whose index `target` is, when that folder also contains `from`. */
  function ownIndexCrossing(from, target) {
    const dir = posixDirname(target);
    return indexDirs.get(dir) === target && isUnder(from, dir) && from !== target ? dir : null;
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
        if (t.kind === 'file') for (const n of exportedNames(t.path, seen)) if (n !== 'default') names.add(n);
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
      } else if (indexDirs.get(posixDirname(t.path)) === t.path && isUnder(target, posixDirname(t.path))) {
        if (forwardsFrom(t.path, target, names, seen)) return true;
      }
    }
    return false;
  }

  return { modules, exceptionFiles, indexDirs, resolve, indexesCrossed, ownIndexCrossing, exportedNames, forwardsFrom };
}

/** A printable report of `analyzeImportPaths`' result. */
export function formatImportPathReport({ violations }) {
  if (!violations.length) return 'import-path guard: clean — every definition has one import path.';
  const lines = [`import-path guard: ${violations.length} violation(s)`];
  for (const v of violations) lines.push(`  [${v.kind}] ${v.file} — ${v.detail}`);
  return lines.join('\n');
}
