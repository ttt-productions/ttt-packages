// What the backend guards share: reading a call's name off the syntax tree, checking an app's facts,
// and the app root's server zone (the files in the app root that run with server privilege).

import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';

/** A reviewed entry the app supplies: what it names and the one line that says why. */
export interface ReviewedFile {
  path: string;
  why: string;
}

/** The called function's own name: `f(…)` → `f`, `a.b.f(…)` → `f`. */
export function calleeName(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}

/** `a` or `a.b` for a call whose callee is an identifier or one member of one. */
export function calleePath(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) return `${callee.expression.text}.${callee.name.text}`;
  return undefined;
}

/** An expression with its casts and parentheses taken off. */
export function unwrap(expression: ts.Expression): ts.Expression {
  let e = expression;
  while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}

/** Every node of a file, depth first. */
export function forEachNode(root: ts.Node, visit: (node: ts.Node) => void): void {
  const walk = (node: ts.Node) => {
    visit(node);
    ts.forEachChild(node, walk);
  };
  walk(root);
}

/** The 1-based line a node starts on. */
export function lineOfNode(file: FileView, node: ts.Node): number {
  return file.lineOf(node.getStart(file.sourceFile));
}

/** Every module specifier a file names: imports, `export … from`, `import()`, and `require()`. */
export function moduleSpecifiers(file: FileView): Array<{ spec: string; node: ts.Node; typeOnly: boolean; dynamic: boolean }> {
  const out: Array<{ spec: string; node: ts.Node; typeOnly: boolean; dynamic: boolean }> = [];
  forEachNode(file.sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({ spec: node.moduleSpecifier.text, node, typeOnly: !!node.importClause?.isTypeOnly, dynamic: false });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({ spec: node.moduleSpecifier.text, node, typeOnly: node.isTypeOnly, dynamic: false });
    } else if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteralLike(node.arguments[0]!)) {
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (isImport || isRequire) out.push({ spec: (node.arguments[0] as ts.StringLiteralLike).text, node, typeOnly: false, dynamic: isImport });
    }
  });
  return out;
}

/** True when `spec` is `name` itself or one of its subpaths. */
export const namesModule = (spec: string, name: string): boolean => spec === name || spec.startsWith(`${name}/`);

/** True when `path` is `folder` or lies under it. */
export const isUnder = (path: string, folder: string): boolean => path === folder || path.startsWith(`${folder}/`);

// ---------------------------------------------------------------------------------------------
// Fact checks. Every fact is required; an app with none of a list declares it empty.

export function textProblem(value: unknown, what: string, problems: string[]): void {
  if (typeof value !== 'string' || !value.trim()) problems.push(`${what} is missing`);
}

export function namesProblem(value: unknown, what: string, problems: string[], { nonEmpty = true } = {}): void {
  if (!Array.isArray(value)) {
    problems.push(`${what} is missing${nonEmpty ? '' : ' (declare [] when there is none)'}`);
    return;
  }
  if (nonEmpty && !value.length) problems.push(`${what} is empty, so the guard checks nothing`);
  const seen = new Set<string>();
  for (const name of value) {
    if (typeof name !== 'string' || !name.trim()) problems.push(`${what} holds an empty entry`);
    else if (seen.has(name)) problems.push(`${what} lists ${name} twice`);
    else seen.add(name);
  }
}

/** A reviewed list: each entry names its `key` and carries a why; none is listed twice. */
export function reviewedProblems(
  value: unknown,
  what: string,
  problems: string[],
  key: string | ((entry: Record<string, unknown>) => string | undefined) = 'path',
): void {
  if (!Array.isArray(value)) {
    problems.push(`${what} is missing (declare [] when there is none)`);
    return;
  }
  const seen = new Set<string>();
  for (const entry of value as Array<Record<string, unknown>>) {
    const id = typeof key === 'function' ? key(entry ?? {}) : (entry?.[key] as string | undefined);
    if (typeof id !== 'string' || !id.trim()) {
      problems.push(`an entry of ${what} names nothing`);
      continue;
    }
    if (typeof entry.why !== 'string' || !entry.why.trim()) problems.push(`${what} entry ${id} carries no why`);
    if (seen.has(id)) problems.push(`${what} lists ${id} twice`);
    seen.add(id);
  }
}

// ---------------------------------------------------------------------------------------------
// The server zone of the app root.

/**
 * The files in the app root that run with server privilege: those under a declared server folder,
 * and any other that imports a declared server-only module (so a privileged module parked elsewhere
 * in the app root is still read). Everything else in the app root ships to the browser.
 */
export interface ServerZone {
  /** App-root folders that hold only server code, repo-relative. */
  folders: readonly string[];
  /** Module specifiers only server code imports (the Admin SDK, the app's own wrapper of it). */
  serverModules: readonly string[];
}

export function serverZoneProblems(zone: ServerZone | undefined, what: string, problems: string[]): void {
  if (!zone || typeof zone !== 'object') {
    problems.push(`${what} is missing (an app with no server code in its app root declares { folders: [], serverModules: [] })`);
    return;
  }
  namesProblem(zone.folders, `${what}.folders`, problems, { nonEmpty: false });
  namesProblem(zone.serverModules, `${what}.serverModules`, problems, { nonEmpty: false });
}

export function inServerZone(file: FileView, zone: ServerZone): boolean {
  if (zone.folders.some((folder) => isUnder(file.path, folder))) return true;
  return moduleSpecifiers(file).some(({ spec }) => zone.serverModules.some((m) => namesModule(spec, m)));
}

/** Each declared server folder that no longer exists. */
export function staleServerFolders(context: GuardContext, zone: ServerZone): Finding[] {
  return zone.folders
    .filter((folder) => !context.reader.exists(folder))
    .map((folder) => ({ file: folder, detail: 'stale server folder: it no longer exists' }));
}

/**
 * A context whose app-root files are only the server zone's. A guard built on a shape runs through
 * it, so the shape reads the server code of the app root and every file of the other roots.
 */
export function serverZoneContext(context: GuardContext, zone: ServerZone): GuardContext {
  return {
    reader: context.reader,
    file: (relPath) => context.file(relPath),
    files: (scope: Scope) => context.files(scope).filter((file) => file.role !== 'app' || inServerZone(file, zone)),
    rulesFiles: (service) => context.rulesFiles(service),
  };
}
