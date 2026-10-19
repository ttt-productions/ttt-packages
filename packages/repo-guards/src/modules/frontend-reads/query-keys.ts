// Every cache key has one owner: the app's query-key module. Nothing else spells a key, a key
// fragment, or a second key object, the module never holds two names for one key, and a key for
// the signed-in account's own data carries that account's uid.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../suite/config.js';
import type { Finding } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import { forEachNode, lineOfNode } from '../../support/ast.js';
import { escapeRegExp } from '../../support/text.js';
import { pathProblem } from '../../support/facts.js';
import { APP_CODE, declaredObjects, identifierListProblem, requiredFile } from './shared.js';

// =============================================================================================
// Query keys: one owner, no hand-typed keys or prefixes, no alias builders, no second key object.
// =============================================================================================

export interface QueryKeyFacts {
  /** The app's one query-key module. */
  keyModule: string;
}

const RAW_QUERY_KEY = /queryKey:\s*(?:readonly\s+)?\[/g;
/** query-core's option that takes a key's first element. */
const RAW_QUERY_KEY_PREFIX = /queryKeyPrefix\s*:\s*['"`]/g;
/** TanStack Query's cache methods that take the key as their first positional argument. */
const POSITIONAL_KEY_CALL =
  /\.\s*(?:setQueryData|getQueryData|getQueryState|removeQueries|invalidateQueries|refetchQueries|cancelQueries|resetQueries|prefetchQuery|fetchQuery|ensureQueryData)\(\s*\[/g;

const TYPE_KEYWORDS = new Set(['string', 'number', 'boolean', 'bigint', 'symbol', 'object', 'unknown', 'any', 'never', 'null', 'undefined', 'void']);

function closingBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '[') depth += 1;
    else if (text[i] === ']' && --depth === 0) return i;
  }
  return -1;
}

/** A `queryKey: [ … ]` whose contents are a tuple TYPE (`[string, string]`) declares a key's shape and spells no key. */
function isTupleType(inner: string): boolean {
  const elements = inner.split(',').map((e) => e.trim()).filter(Boolean);
  if (!elements.length) return false;
  return elements.every((element) =>
    element
      .replace(/^\.\.\./, '')
      .split(/[|&]/)
      .every((part) => TYPE_KEYWORDS.has(part.trim().replace(/^readonly\s+/, '').replace(/(?:\s*\[\s*\])+$/, '').replace(/\?$/, '').trim())),
  );
}

/** Every key spelled at a call site in one file: a key array, a positional key array, a literal key prefix. */
export function handTypedKeys(file: FileView, isKeyModule: boolean): Array<{ index: number; detail: string }> {
  const code = file.code;
  const hits: Array<{ index: number; detail: string }> = [];
  if (!isKeyModule) {
    for (const m of code.matchAll(RAW_QUERY_KEY)) {
      const open = (m.index ?? 0) + m[0].length - 1;
      const close = closingBracket(code, open);
      if (close !== -1 && isTupleType(code.slice(open + 1, close))) continue;
      hits.push({ index: m.index ?? 0, detail: 'a hand-typed queryKey array' });
    }
    for (const m of code.matchAll(POSITIONAL_KEY_CALL)) hits.push({ index: m.index ?? 0, detail: 'a hand-typed key array passed to a cache method' });
  }
  for (const m of code.matchAll(RAW_QUERY_KEY_PREFIX)) hits.push({ index: m.index ?? 0, detail: 'a literal queryKeyPrefix' });
  return hits.sort((a, b) => a.index - b.index);
}

interface KeyBuilder {
  object: string;
  name: string;
  params: string[];
  body: string;
  line: number;
  delegatesTo: string | null;
}

/** Every builder member (`name: (params) => body`) of every key object the module exports. */
export function keyBuilders(file: FileView): KeyBuilder[] {
  const sf = file.sourceFile;
  const objects = declaredObjects(sf);
  const names = new Set(objects.map((o) => o.name));
  const out: KeyBuilder[] = [];
  for (const { name: object, object: literal } of objects) {
    for (const prop of literal.properties) {
      if (!ts.isPropertyAssignment(prop) || !(ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) continue;
      const fn = prop.initializer;
      if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) continue;
      let body: ts.Node = fn.body;
      while (ts.isAsExpression(body as ts.Expression) || ts.isParenthesizedExpression(body as ts.Expression)) body = (body as ts.AsExpression).expression;
      let delegatesTo: string | null = null;
      if (ts.isCallExpression(body) && ts.isPropertyAccessExpression(body.expression) && ts.isIdentifier(body.expression.expression)) {
        const target = body.expression.expression.text;
        if (names.has(target)) delegatesTo = `${target}.${body.expression.name.text}`;
      }
      out.push({
        object,
        name: prop.name.text,
        params: fn.parameters.map((p) => p.name.getText(sf)),
        body: file.code.slice(body.getStart(sf), body.getEnd()),
        line: lineOfNode(file, prop),
        delegatesTo,
      });
    }
  }
  return out;
}

const normalizedBody = ({ body, params }: KeyBuilder) => {
  let out = body;
  params.forEach((param, i) => {
    out = out.replace(new RegExp(`(?<![\\w$])${escapeRegExp(param)}(?![\\w$])`, 'g'), () => `$${i + 1}`);
  });
  return out.replace(/\s+/g, ' ').trim();
};

/** Builders that are a second name for a key: one that delegates to another, or two whose bodies build one key. */
export function aliasBuilders(builders: readonly KeyBuilder[]): Array<{ line: number; detail: string }> {
  const hits: Array<{ line: number; detail: string }> = [];
  const byBody = new Map<string, KeyBuilder[]>();
  for (const builder of builders) {
    if (builder.delegatesTo) {
      hits.push({ line: builder.line, detail: `${builder.object}.${builder.name} delegates to ${builder.delegatesTo}(…), a second name for its key` });
      continue;
    }
    const key = normalizedBody(builder);
    byBody.set(key, [...(byBody.get(key) ?? []), builder]);
  }
  for (const [body, group] of byBody) {
    if (group.length < 2) continue;
    for (const builder of group.slice(1)) {
      hits.push({ line: builder.line, detail: `${builder.object}.${builder.name} builds the same key as ${group[0].object}.${group[0].name}: ${body.slice(0, 100)}` });
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

export const queryKeysGuard: GenericGuardDefinition<QueryKeyFacts> = {
  id: 'queryKeys',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.keyModule, 'keyModule', problems);
    return problems;
  },
  build: (facts) => [
    {
      title: 'every query key is a named builder in the one query-key module',
      description:
        `Every cache key is a named member of a key object in ${facts.keyModule}. No other file hand-types a key — a queryKey: [ … ] array ` +
        '(a builder result with a literal appended included), a key array passed to a cache method, or a literal queryKeyPrefix — and no ' +
        `other file declares a second object under a key object's name. Inside ${facts.keyModule}, no member delegates to another member ` +
        'and no two members build the same key: an invalidation written against one name never reaches a query keyed by the other. Add or ' +
        'reuse one named member and point every call site at it.',
      run(context) {
        const { file: module, findings } = requiredFile(context, facts.keyModule, 'the query-key module');
        if (!module) return findings;
        const builders = keyBuilders(module);
        const objectNames = [...new Set(declaredObjects(module.sourceFile).map((o) => o.name))];
        if (!builders.length) findings.push({ file: facts.keyModule, detail: 'no key builder found in the module (an exported object of name: (params) => key members), so the alias check checks nothing' });
        for (const hit of aliasBuilders(builders)) findings.push({ file: facts.keyModule, ...hit });
        const secondObject = objectNames.length ? new RegExp(`\\b(?:const|let|var)\\s+(${objectNames.map(escapeRegExp).join('|')})\\s*=`, 'g') : null;
        for (const file of context.files(APP_CODE)) {
          const isKeyModule = file.path === facts.keyModule;
          for (const hit of handTypedKeys(file, isKeyModule)) findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail });
          if (secondObject && !isKeyModule) {
            for (const m of file.code.matchAll(secondObject)) {
              findings.push({ file: file.path, line: file.lineOf(m.index ?? 0), detail: `a second ${m[1]} beside the one in ${facts.keyModule}` });
            }
          }
        }
        return findings;
      },
    },
  ],
};

// =============================================================================================
// A key for the signed-in account's own data takes the uid.
// =============================================================================================

export interface AuthScopedKeyFacts {
  keyModule: string;
  /** Name prefixes that mark a key method as the signed-in account's own (`my`, `current`, `own`). */
  authScopedPrefixes: readonly string[];
  /** The names a uid parameter goes by. */
  uidParamNames: readonly string[];
}

/** Every auth-scoped key method whose first parameter is not the uid, or that leaves the uid out of the key. */
export function keyMethodsWithoutUid(file: FileView, facts: AuthScopedKeyFacts): Array<{ line: number; detail: string }> {
  const sf = file.sourceFile;
  const scoped = new RegExp(`^(?:${facts.authScopedPrefixes.map(escapeRegExp).join('|')})[A-Z]`);
  const uidNames = new Set(facts.uidParamNames);
  const hits: Array<{ line: number; detail: string }> = [];
  const visit = (node: ts.Node, owner: string) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) owner = node.name.text;
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      scoped.test(node.name.text) &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      const first = node.initializer.parameters[0];
      const uid = first && ts.isIdentifier(first.name) && uidNames.has(first.name.text) ? first.name.text : null;
      let used = false;
      if (uid) forEachNode(node.initializer.body, (n) => {
        if (ts.isIdentifier(n) && n.text === uid) used = true;
      });
      if (!uid || !used) hits.push({ line: lineOfNode(file, node), detail: `${owner}.${node.name.text} ${uid ? 'leaves the uid out of the key' : 'does not take the uid first'}` });
    }
    ts.forEachChild(node, (child) => visit(child, owner));
  };
  visit(sf, '');
  return hits;
}

export const authScopedKeysGuard: GenericGuardDefinition<AuthScopedKeyFacts> = {
  id: 'authScopedKeys',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.keyModule, 'keyModule', problems);
    identifierListProblem(facts?.authScopedPrefixes, 'authScopedPrefixes', problems, { nonEmpty: true });
    identifierListProblem(facts?.uidParamNames, 'uidParamNames', problems, { nonEmpty: true });
    return problems;
  },
  build: (facts) => [
    {
      title: "a key for the signed-in account's own data takes the uid",
      description:
        `A key method in ${facts.keyModule} for the signed-in account's own data (named ${facts.authScopedPrefixes.map((p) => `${p}…`).join(' / ')}) ` +
        `takes the uid (${facts.uidParamNames.join(' / ')}) as its first parameter and puts it in the key, so a direct switch from one ` +
        "account to another never serves the first account's cached rows to the second.",
      run(context) {
        const { file, findings }: { file: FileView | null; findings: Finding[] } = requiredFile(context, facts.keyModule, 'the query-key module');
        if (!file) return findings;
        return [...findings, ...keyMethodsWithoutUid(file, facts).map((hit) => ({ file: file.path, ...hit }))];
      },
    },
  ],
};

export const QUERY_KEY_GUARDS = [queryKeysGuard, authScopedKeysGuard] as const;
