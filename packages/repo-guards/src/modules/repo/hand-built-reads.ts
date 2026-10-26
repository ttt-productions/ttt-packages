import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { forEachNode, unwrap } from '../../support/ast.js';
import {
  anchoredFindings,
  anchoredProblems,
  type AnchoredEntry,
  type Occurrence,
} from '../../support/anchored-review.js';
import { objectProblem } from '../../support/facts.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const SCOPE: Scope = {
  roots: ['app', 'functions', 'scripts', 'workers'],
  kinds: ['code'],
  tests: 'only',
  optionalRoots: ['functions', 'scripts', 'workers'],
};

const OBSERVERS = new Set(['QueryObserver', 'InfiniteQueryObserver']);

const propertyNameOf = (name: ts.PropertyName): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;

const calledMember = (node: ts.Expression, member: string): ts.CallExpression | null => {
  const inner = unwrap(node);
  return ts.isCallExpression(inner) &&
    ts.isPropertyAccessExpression(inner.expression) &&
    inner.expression.name.text === member
    ? inner
    : null;
};

const isRetryStateType = (type: ts.TypeNode | undefined): boolean =>
  !!type &&
  ts.isTypeReferenceNode(type) &&
  ts.isIdentifier(type.typeName) &&
  type.typeName.text === 'ReadRetryState';

const constructedObserver = (node: ts.Expression): string | null => {
  const inner = unwrap(node);
  return ts.isNewExpression(inner) &&
    ts.isIdentifier(inner.expression) &&
    OBSERVERS.has(inner.expression.text)
    ? inner.expression.text
    : null;
};

export function handBuiltReads(source: FileView | string): Occurrence[] {
  const file = typeof source === 'string' ? viewOfText('sample.test.ts', source) : source;
  const sf = file.sourceFile;
  const hits: Occurrence[] = [];
  const hit = (node: ts.Node, detail: string) =>
    hits.push({ start: node.getStart(sf), end: node.getEnd(), detail });
  const declaredIn = (scope: ts.Node, name: string): ts.VariableDeclaration | null => {
    const statements = ts.isSourceFile(scope) || ts.isBlock(scope) ? scope.statements : [];
    for (const statement of statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return declaration;
    }
    return null;
  };
  const declarationOf = (identifier: ts.Identifier): ts.VariableDeclaration | null => {
    for (let scope: ts.Node | undefined = identifier.parent; scope; scope = scope.parent) {
      const declaration = declaredIn(scope, identifier.text);
      if (declaration) return declaration;
    }
    return null;
  };
  const subscribed = new Set<ts.VariableDeclaration>();
  forEachNode(sf, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (node.expression.name.text !== 'subscribe') return;
    const target = unwrap(node.expression.expression);
    const declaration = ts.isIdentifier(target) ? declarationOf(target) : null;
    if (declaration) subscribed.add(declaration);
  });
  const observerOf = (node: ts.Expression): { kind: string; site: ts.Node } | null => {
    const inner = unwrap(node);
    if (!ts.isIdentifier(inner)) {
      const kind = constructedObserver(inner);
      return kind ? { kind, site: inner } : null;
    }
    const declaration = declarationOf(inner);
    if (!declaration?.initializer || subscribed.has(declaration)) return null;
    const kind = constructedObserver(declaration.initializer);
    return kind ? { kind, site: declaration.initializer } : null;
  };
  const reported = new Set<ts.Node>();
  forEachNode(sf, (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      propertyNameOf(node.name) === 'retryState' &&
      ts.isObjectLiteralExpression(unwrap(node.initializer))
    )
      hit(node, 'a read’s retryState is written as a literal');
    else if (
      ts.isVariableDeclaration(node) &&
      isRetryStateType(node.type) &&
      node.initializer &&
      ts.isObjectLiteralExpression(unwrap(node.initializer))
    )
      hit(node, 'a ReadRetryState is written as a literal');
    else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.text === 'getCurrentResult') {
        const observer = observerOf(node.expression.expression);
        if (observer && !reported.has(observer.site)) {
          reported.add(observer.site);
          hit(
            observer.site,
            `a test reads a result off an observer it built itself (${observer.kind})`,
          );
        }
        return;
      }
      if (node.expression.name.text !== 'setState') return;
      const build = calledMember(node.expression.expression, 'build');
      if (build && ts.isPropertyAccessExpression(build.expression)) {
        const cache = calledMember(build.expression.expression, 'getQueryCache');
        if (cache) hit(node, 'a test seeds a query’s state into the cache by hand');
      }
    }
  });
  return hits;
}

export interface HandBuiltReadFacts {
  reviewed: readonly AnchoredEntry[];
}

export const handBuiltReadGuard: GenericGuardDefinition<HandBuiltReadFacts> = {
  id: 'handBuiltReads',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'the facts', problems)) return problems;
    anchoredProblems(facts.reviewed, 'reviewed', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no test builds a read’s state by hand',
        description:
          'A test takes a read’s state from the read builders or from the real hook, never from a hand-written ' +
          '`retryState` or `ReadRetryState` literal, a result read off a `QueryObserver` / `InfiniteQueryObserver` ' +
          'it constructed itself, or a query cache seeded with `getQueryCache().build(…).setState(…)`. Each of those type-checks ' +
          'while combining flags no real read reaches, so a case passes on a state the product never sees. An ' +
          'observer the test subscribes, watching a real query run, is not a hand-built state and passes. A ' +
          'test whose subject is that shape itself is a reviewed entry whose anchor names the one construct, ' +
          'with its why; an entry that no longer matches one is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run: (context) =>
          anchoredFindings(
            context.files(SCOPE).map((file) => ({ file, hits: handBuiltReads(file) })),
            facts.reviewed,
            'its anchor names no hand-built read',
          ),
      },
    ];
  },
};
