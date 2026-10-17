// What the Firestore and Storage guards share: the reviewed-entry checks every fact list runs, a
// guard over a matcher with no exceptions, and the small syntax-tree readers the matchers use.

import ts from 'typescript';
import type { Finding, Guard } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';

/** The facts of a guard that needs none: the app states it runs the guard with `{}`. */
export type NoFacts = Readonly<Record<string, never>>;

export const noFactProblems = (facts: unknown): string[] =>
  facts && typeof facts === 'object' && !Array.isArray(facts) && Object.keys(facts).length === 0
    ? []
    : ['this guard takes no facts: declare it with {}'];

/** Problems with a list of reviewed entries: each names its `key` field and carries a why. */
export function reviewedListProblems(
  value: unknown,
  what: string,
  key: string,
  { nonEmpty = false }: { nonEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(value)) return [`${what} is missing (declare [] when there is none)`];
  if (nonEmpty && !value.length) return [`${what} is empty`];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of value as Array<Record<string, unknown>>) {
    const name = entry?.[key];
    if (typeof name !== 'string' || !name.trim()) {
      problems.push(`an entry of ${what} names no ${key}`);
      continue;
    }
    const id = JSON.stringify(Object.entries(entry).filter(([k]) => k !== 'why'));
    if (seen.has(id)) problems.push(`${what}: ${name} is listed twice`);
    seen.add(id);
    if (typeof entry.why !== 'string' || !entry.why.trim()) problems.push(`${what}: ${name} carries no why`);
  }
  return problems;
}

/** Problems with a list of names: present, every one a non-empty string, none twice. */
export function nameListProblems(value: unknown, what: string, { nonEmpty = true }: { nonEmpty?: boolean } = {}): string[] {
  if (!Array.isArray(value)) return [`${what} is missing (declare [] when there is none)`];
  if (nonEmpty && !value.length) return [`${what} is empty`];
  const problems: string[] = [];
  if (value.some((v) => typeof v !== 'string' || !v.trim())) problems.push(`${what} holds an empty name`);
  if (new Set(value).size !== value.length) problems.push(`${what} names one entry twice`);
  return problems;
}

export const requireLoader = (value: unknown, what: string): string[] =>
  typeof value === 'function' ? [] : [`${what} needs a loader function`];

export const requireName = (value: unknown, what: string): string[] =>
  typeof value === 'string' && value.trim() ? [] : [`${what} is missing`];

/** One place a matcher hit: the node it is about, and what to say. */
export interface NodeHit {
  node: ts.Node;
  detail: string;
}

export const lineOfNode = (file: FileView, node: ts.Node) => file.lineOf(node.getStart(file.sourceFile));

/** Findings for a file's hits, in source order. */
export const findingsOf = (file: FileView, hits: readonly NodeHit[]): Finding[] =>
  [...hits]
    .sort((a, b) => a.node.getStart(file.sourceFile) - b.node.getStart(file.sourceFile))
    .map((hit) => ({ file: file.path, line: lineOfNode(file, hit.node), detail: hit.detail }));

/** A guard that fails on every hit of its matcher in its scope: a pattern with no exception. */
export function bannedGuard(input: {
  title: string;
  description: string;
  scope: Scope;
  match: (file: FileView) => readonly NodeHit[];
  timeoutMs?: number;
}): Guard {
  return {
    title: input.title,
    description: input.description,
    timeoutMs: input.timeoutMs ?? 120_000,
    run(context) {
      return context.files(input.scope).flatMap((file) => findingsOf(file, input.match(file)));
    },
  };
}

/** Visits every node of a parsed file. */
export function eachNode(root: ts.Node, visit: (node: ts.Node) => void) {
  const walk = (node: ts.Node) => {
    visit(node);
    ts.forEachChild(node, walk);
  };
  walk(root);
}

/** The called name: `f(…)` → `f`, `a.b.f(…)` → `f`; anything else → null. */
export function calleeName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

/** A plain string: a quoted literal or a backtick with no `${` hole. */
export const isPlainString = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/** Strips `(…)`, `as …`, `satisfies …`, and `!` off an expression. */
export function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  for (;;) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isNonNullExpression(current)) {
      current = current.expression;
    } else return current;
  }
}

/**
 * Every name the file binds to a plain string literal (`const|let|var NAME = '…'`), at any depth.
 * Resolution is file-local on purpose: an imported name is its own module's declaration, and that
 * module is read on its own.
 */
export function literalBindings(source: ts.SourceFile): Map<string, string> {
  const names = new Map<string, string>();
  eachNode(source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = unwrap(node.initializer);
      if (isPlainString(value)) names.set(node.name.text, value.text);
    }
  });
  return names;
}

/** `ROOT.member` (or `ROOT.a.b`) whose root identifier is one of `roots`. */
export function isMemberOf(node: ts.Node, roots: ReadonlySet<string>): boolean {
  let current: ts.Node = node;
  if (!ts.isPropertyAccessExpression(current) && !ts.isElementAccessExpression(current)) return false;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) current = current.expression;
  return ts.isIdentifier(current) && roots.has(current.text);
}

/** The text of the literal pieces of a template, or of a plain string. */
export function literalText(node: ts.Node): string | null {
  if (isPlainString(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((s) => s.literal.text).join('');
  return null;
}
