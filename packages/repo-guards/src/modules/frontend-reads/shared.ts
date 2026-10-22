import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import {
  identifierProblem,
  loaderProblem,
  namesProblem,
  pathProblem,
  reviewedProblems,
  type Loader,
} from '../../support/facts.js';
import { escapeRegExp, isUnder } from '../../support/text.js';

export const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

export interface KeyModuleFacts {
  path: string;
  load: Loader<Record<string, unknown>>;
}

export interface ReviewedCall {
  path: string;
  call: string;
  why: string;
}

export function identifierListProblem(
  value: unknown,
  what: string,
  problems: string[],
  { nonEmpty }: { nonEmpty: boolean },
): void {
  namesProblem(value, what, problems, { nonEmpty });
  if (Array.isArray(value))
    value.forEach(
      (v, i) =>
        typeof v === 'string' && v.trim() && identifierProblem(v, `${what}[${i}]`, problems),
    );
}

export function pathListProblem(value: unknown, what: string, problems: string[]): void {
  namesProblem(value, what, problems);
  if (Array.isArray(value))
    value.forEach(
      (v, i) => typeof v === 'string' && v.trim() && pathProblem(v, `${what}[${i}]`, problems),
    );
}

export function keyModuleProblem(value: unknown, problems: string[], what = 'keyModule'): void {
  const facts = value as KeyModuleFacts | undefined;
  if (!facts || typeof facts !== 'object') {
    problems.push(`${what} is missing`);
    return;
  }
  pathProblem(facts.path, `${what}.path`, problems);
  loaderProblem(facts.load, `${what}.load`, problems);
}

export function reviewedCallProblem(value: unknown, what: string, problems: string[]): void {
  reviewedProblems(value, what, problems, {
    id: (e) => (typeof e.call === 'string' && e.call.trim() ? `${e.path} ${e.call}` : undefined),
    idNames: 'call',
    extra(entry, label) {
      const call = entry.call;
      if (typeof call === 'string' && call.trim() && collapse(call) !== call)
        problems.push(`${label}: write the call whitespace-collapsed (${collapse(call)})`);
    },
  });
}

export function filesUnder(
  context: GuardContext,
  trees: readonly string[],
): { files: FileView[]; findings: Finding[] } {
  const all = context.files(APP_CODE);
  const findings: Finding[] = [];
  for (const tree of trees) {
    if (!all.some((f) => isUnder(f.path, tree)))
      findings.push({
        file: tree,
        detail:
          'the tree holds no production code the guard can read (moved, or not under the app root)',
      });
  }
  return { files: all.filter((f) => trees.some((tree) => isUnder(f.path, tree))), findings };
}

export function requiredFile(
  context: GuardContext,
  path: string,
  role: string,
): { file: FileView | null; findings: Finding[] } {
  if (!context.reader.exists(path))
    return { file: null, findings: [{ file: path, detail: `${role} no longer exists` }] };
  return { file: context.file(path), findings: [] };
}

export const isHookName = (name: string) => /^use[A-Z][\w$]*$/.test(name);

export function callSpan(code: string, start: number, open: number): string {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if ('([{'.includes(code[i])) depth += 1;
    else if (')]}'.includes(code[i]) && --depth === 0) return code.slice(start, i + 1);
  }
  return code.slice(start);
}

export const collapse = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/,(\s*[)\]}])/g, '$1')
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')');

export const alternation = (names: readonly string[]) =>
  names.length ? names.map(escapeRegExp).join('|') : '(?!)';

export type KeyBuilders = Record<string, Record<string, unknown>>;

const placeholders = (n: number) => Array.from({ length: n }, (_, i) => `$${i + 1}`);

export function keyObjectsOf(exports: Record<string, unknown>): KeyBuilders {
  const out: KeyBuilders = {};
  for (const [name, value] of Object.entries(exports)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const members = Object.values(value as Record<string, unknown>);
    const buildsKeys = members.some((member) => {
      if (Array.isArray(member)) return true;
      if (typeof member !== 'function') return false;
      try {
        return Array.isArray(
          (member as (...a: string[]) => unknown)(...placeholders(member.length)),
        );
      } catch {
        return false;
      }
    });
    if (buildsKeys) out[name] = value as Record<string, unknown>;
  }
  return out;
}

export async function loadKeyObjects(facts: KeyModuleFacts): Promise<KeyBuilders> {
  const exports = await facts.load();
  const objects = keyObjectsOf(exports ?? {});
  if (!Object.keys(objects).length)
    throw new Error(`repo-guards: the key module loader for ${facts.path} returned no key object`);
  return objects;
}

export function sampleKey(ref: string, builders: KeyBuilders): unknown[] | null {
  const [object, method] = ref.split('.');
  const value = builders[object]?.[method === '*' ? 'all' : method];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'function') return null;
  try {
    const key = (value as (...args: string[]) => unknown)(
      ...Array.from({ length: value.length }, () => 'p'),
    );
    return Array.isArray(key) ? key : null;
  } catch {
    return null;
  }
}

export function isPrefix(prefixKey: readonly unknown[], key: readonly unknown[]): boolean {
  return (
    prefixKey.length <= key.length &&
    prefixKey.every((part, i) => JSON.stringify(part) === JSON.stringify(key[i]))
  );
}

export const familyOf = (ref: string, familySuffix: string) =>
  ref.endsWith(familySuffix) && ref.length > familySuffix.length
    ? ref.slice(0, -familySuffix.length)
    : ref;

const INFINITE_READ = /\buse(?:InfiniteQuery|FirestoreInfinite|FirestoreLiveInfinite)\s*(?:<|\()/;

export function infiniteKeyFamilies(
  files: ReadonlyArray<{ code: string }>,
  keyObjects: readonly string[],
  familySuffix: string,
): Set<string> {
  const infinite = new Set<string>();
  const names = alternation(keyObjects);
  for (const { code } of files) {
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      if (!INFINITE_READ.test(line)) return;
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

export function reachesInfinite(
  ref: string,
  infinite: ReadonlySet<string>,
  builders: KeyBuilders,
  familySuffix: string,
): boolean {
  if (infinite.has(familyOf(ref, familySuffix))) return true;
  const key = sampleKey(ref, builders);
  if (key === null) return false;
  return [...infinite]
    .map((f) => sampleKey(f, builders))
    .some((infiniteKey) => infiniteKey !== null && isPrefix(key, infiniteKey));
}

export function declaredObjects(
  sf: ts.SourceFile,
): Array<{ name: string; object: ts.ObjectLiteralExpression }> {
  const out: Array<{ name: string; object: ts.ObjectLiteralExpression }> = [];
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!(ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      continue;
    for (const decl of statement.declarationList.declarations) {
      let init = decl.initializer;
      while (
        init &&
        (ts.isAsExpression(init) ||
          ts.isSatisfiesExpression(init) ||
          ts.isParenthesizedExpression(init))
      )
        init = init.expression;
      if (init && ts.isObjectLiteralExpression(init) && ts.isIdentifier(decl.name))
        out.push({ name: decl.name.text, object: init });
    }
  }
  return out;
}
