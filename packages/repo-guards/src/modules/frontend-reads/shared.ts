// What the client-data-layer guards share: the scope they read, fact checks, syntax helpers, and the
// app's query-key module read two ways — statically for its declarations, and loaded at run time
// for the keys its builders build.

import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';

/** The app's production code: every guard in this area reads the client tree, tests left out. */
export const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

/** A loader the app writes with a literal specifier; the package never imports app code itself. */
export type Loader<T> = () => T | Promise<T>;

/** The app's query-key module: where it is, and a loader of its exports. */
export interface KeyModuleFacts {
  path: string;
  load: Loader<Record<string, unknown>>;
}

/** A reviewed call: the file, the call's whitespace-collapsed text, and why it is allowed. */
export interface ReviewedCall {
  path: string;
  call: string;
  why: string;
}

/** A reviewed file: the file and why it is allowed. */
export interface ReviewedFile {
  path: string;
  why: string;
}

// ---------------------------------------------------------------------------------------------
// Fact checks. Each returns problems in words; an empty list means the fact is usable.
// ---------------------------------------------------------------------------------------------

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function pathProblems(value: unknown, what: string): string[] {
  if (typeof value !== 'string' || !value.trim()) return [`${what} is missing`];
  if (value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value)) return [`${what} (${value}) must be repo-relative and forward-slashed`];
  if (value.endsWith('/')) return [`${what} (${value}) must not end with a slash`];
  return [];
}

export function identifierProblems(value: unknown, what: string): string[] {
  return typeof value === 'string' && IDENTIFIER.test(value) ? [] : [`${what} must be an identifier`];
}

export function identifierListProblems(value: unknown, what: string, { allowEmpty }: { allowEmpty: boolean }): string[] {
  if (!Array.isArray(value)) return [`${what} is missing (an app with none declares [])`];
  if (!allowEmpty && !value.length) return [`${what} names nothing`];
  const problems = value.flatMap((v, i) => identifierProblems(v, `${what}[${i}]`));
  if (new Set(value).size !== value.length) problems.push(`${what} lists a name twice`);
  return problems;
}

export function pathListProblems(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || !value.length) return [`${what} names no path`];
  const problems = value.flatMap((v, i) => pathProblems(v, `${what}[${i}]`));
  if (new Set(value).size !== value.length) problems.push(`${what} lists a path twice`);
  return problems;
}

export function loaderProblems(value: unknown, what: string): string[] {
  return typeof value === 'function' ? [] : [`${what} needs a loader the app writes (() => import(...))`];
}

export function keyModuleProblems(value: unknown, what = 'keyModule'): string[] {
  const facts = value as KeyModuleFacts | undefined;
  if (!facts || typeof facts !== 'object') return [`${what} is missing`];
  return [...pathProblems(facts.path, `${what}.path`), ...loaderProblems(facts.load, `${what}.load`)];
}

export function reviewedFileProblems(value: unknown, what: string): string[] {
  if (!Array.isArray(value)) return [`${what} is missing (an app with none declares [])`];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of value as ReviewedFile[]) {
    const p = pathProblems(entry?.path, `a ${what} entry's path`);
    if (p.length) {
      problems.push(...p);
      continue;
    }
    if (seen.has(entry.path)) problems.push(`${what} lists ${entry.path} twice`);
    seen.add(entry.path);
    if (typeof entry.why !== 'string' || !entry.why.trim()) problems.push(`${what} entry ${entry.path} carries no why`);
  }
  return problems;
}

export function reviewedCallProblems(value: unknown, what: string): string[] {
  if (!Array.isArray(value)) return [`${what} is missing (an app with none declares [])`];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of value as ReviewedCall[]) {
    const p = pathProblems(entry?.path, `a ${what} entry's path`);
    if (p.length) {
      problems.push(...p);
      continue;
    }
    if (typeof entry.call !== 'string' || !entry.call.trim()) {
      problems.push(`${what} entry ${entry.path} names no call`);
      continue;
    }
    if (collapse(entry.call) !== entry.call) problems.push(`${what} entry ${entry.path}: write the call whitespace-collapsed (${collapse(entry.call)})`);
    const id = `${entry.path} ${entry.call}`;
    if (seen.has(id)) problems.push(`${what} lists ${id} twice`);
    seen.add(id);
    if (typeof entry.why !== 'string' || !entry.why.trim()) problems.push(`${what} entry ${entry.path} carries no why`);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Reading.
// ---------------------------------------------------------------------------------------------

export const isUnder = (path: string, tree: string) => path === tree || path.startsWith(`${tree}/`);

/** The app's production files under one of the trees, and a finding for each tree that holds none. */
export function filesUnder(context: GuardContext, trees: readonly string[]): { files: FileView[]; findings: Finding[] } {
  const all = context.files(APP_CODE);
  const findings: Finding[] = [];
  for (const tree of trees) {
    if (!all.some((f) => isUnder(f.path, tree))) findings.push({ file: tree, detail: 'the tree holds no production code the guard can read (moved, or not under the app root)' });
  }
  return { files: all.filter((f) => trees.some((tree) => isUnder(f.path, tree))), findings };
}

/** One named file, or a finding saying it is gone. */
export function requiredFile(context: GuardContext, path: string, role: string): { file: FileView | null; findings: Finding[] } {
  if (!context.reader.exists(path)) return { file: null, findings: [{ file: path, detail: `${role} no longer exists` }] };
  return { file: context.file(path), findings: [] };
}

export function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

export const lineOfNode = (sf: ts.SourceFile, node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

/** `use` followed by an uppercase letter — the name rules-of-hooks treats as a hook. */
export const isHookName = (name: string) => /^use[A-Z][\w$]*$/.test(name);

/** The text of the call whose `(` is at `open`, from `start` through its matching `)`. */
export function callSpan(code: string, start: number, open: number): string {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if ('([{'.includes(code[i])) depth += 1;
    else if (')]}'.includes(code[i]) && --depth === 0) return code.slice(start, i + 1);
  }
  return code.slice(start);
}

/** A call's text with its whitespace and trailing commas collapsed — the form a reviewed call is written in. */
export const collapse = (text: string) =>
  text.replace(/\s+/g, ' ').replace(/,(\s*[)\]}])/g, '$1').replace(/\(\s/g, '(').replace(/\s\)/g, ')');

export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** An alternation of names for a regular expression, or a pattern that matches nothing. */
export const alternation = (names: readonly string[]) => (names.length ? names.map(escapeRegExp).join('|') : '(?!)');

// ---------------------------------------------------------------------------------------------
// The query-key module.
// ---------------------------------------------------------------------------------------------

export type KeyBuilders = Record<string, Record<string, unknown>>;

const placeholders = (n: number) => Array.from({ length: n }, (_, i) => `$${i + 1}`);

/**
 * The key objects a loaded key module exports: an exported plain object with at least one member
 * that is a key (an array) or builds one. An exported helper whose members build strings is not one.
 */
export function keyObjectsOf(exports: Record<string, unknown>): KeyBuilders {
  const out: KeyBuilders = {};
  for (const [name, value] of Object.entries(exports)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const members = Object.values(value as Record<string, unknown>);
    const buildsKeys = members.some((member) => {
      if (Array.isArray(member)) return true;
      if (typeof member !== 'function') return false;
      try {
        return Array.isArray((member as (...a: string[]) => unknown)(...placeholders(member.length)));
      } catch {
        return false;
      }
    });
    if (buildsKeys) out[name] = value as Record<string, unknown>;
  }
  return out;
}

/** Loads the app's key module and keeps its key objects; a module that exports none is a problem. */
export async function loadKeyObjects(facts: KeyModuleFacts): Promise<KeyBuilders> {
  const exports = await facts.load();
  const objects = keyObjectsOf(exports ?? {});
  if (!Object.keys(objects).length) throw new Error(`repo-guards: the key module loader for ${facts.path} returned no key object`);
  return objects;
}

/**
 * The key a reference builds, every argument a placeholder: a key method is called, a key value
 * (a scope's `all`) is taken as it is. A family read whole (`x.*`) stands for its `all`.
 */
export function sampleKey(ref: string, builders: KeyBuilders): unknown[] | null {
  const [object, method] = ref.split('.');
  const value = builders[object]?.[method === '*' ? 'all' : method];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'function') return null;
  try {
    const key = (value as (...args: string[]) => unknown)(...Array.from({ length: value.length }, () => 'p'));
    return Array.isArray(key) ? key : null;
  } catch {
    return null;
  }
}

export function isPrefix(prefixKey: readonly unknown[], key: readonly unknown[]): boolean {
  return prefixKey.length <= key.length && prefixKey.every((part, i) => JSON.stringify(part) === JSON.stringify(key[i]));
}

/** A family helper (named with the app's family suffix) addresses the family of the method it names. */
export const familyOf = (ref: string, familySuffix: string) =>
  ref.endsWith(familySuffix) && ref.length > familySuffix.length ? ref.slice(0, -familySuffix.length) : ref;

/** The TanStack Query and query-core hooks that read an infinite list. */
const INFINITE_READ = /\buse(?:InfiniteQuery|FirestoreInfinite|FirestoreLiveInfinite)\s*(?:<|\()/;

/** The key families read by an infinite query, as `object.method` refs. */
export function infiniteKeyFamilies(files: ReadonlyArray<{ code: string }>, keyObjects: readonly string[], familySuffix: string): Set<string> {
  const infinite = new Set<string>();
  const names = alternation(keyObjects);
  for (const { code } of files) {
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      if (!INFINITE_READ.test(line)) return;
      // The call's own header: from the hook name through its `queryKey`.
      const header = lines.slice(i, i + 25);
      const keyLine = header.findIndex((l) => /\bqueryKey\b/.test(l));
      const window = header.slice(0, keyLine === -1 ? header.length : keyLine + 1).join('\n');
      const generic = window.match(new RegExp(`ReturnType<typeof (${names})\\.(\\w+)>`));
      const direct = window.match(new RegExp(`\\bqueryKey\\s*:\\s*(${names})\\.(\\w+)`));
      if (generic) infinite.add(familyOf(`${generic[1]}.${generic[2]}`, familySuffix));
      if (direct) infinite.add(familyOf(`${direct[1]}.${direct[2]}`, familySuffix));
      if (!generic && !direct && /\bqueryKey\s*,/.test(window)) {
        const before = lines.slice(Math.max(0, i - 10), i).join('\n');
        const local = before.match(new RegExp(`const queryKey\\s*=\\s*(${names})\\.(\\w+)`));
        if (local) infinite.add(familyOf(`${local[1]}.${local[2]}`, familySuffix));
      }
    });
  }
  return infinite;
}

/** Whether a key ref reaches an infinite list: named, through its family helper, or through a scope. */
export function reachesInfinite(ref: string, infinite: ReadonlySet<string>, builders: KeyBuilders, familySuffix: string): boolean {
  if (infinite.has(familyOf(ref, familySuffix))) return true;
  const key = sampleKey(ref, builders);
  if (key === null) return false;
  return [...infinite].map((f) => sampleKey(f, builders)).some((infiniteKey) => infiniteKey !== null && isPrefix(key, infiniteKey));
}

/** Every exported object literal in a module, as the key objects its source declares. */
export function declaredObjects(sf: ts.SourceFile): Array<{ name: string; object: ts.ObjectLiteralExpression }> {
  const out: Array<{ name: string; object: ts.ObjectLiteralExpression }> = [];
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!(ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const decl of statement.declarationList.declarations) {
      let init = decl.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init))) init = init.expression;
      if (init && ts.isObjectLiteralExpression(init) && ts.isIdentifier(decl.name)) out.push({ name: decl.name.text, object: init });
    }
  }
  return out;
}
