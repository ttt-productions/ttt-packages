// Syntax-tree helpers every guard area shares, over the parse the reader made once. Internal to the
// package: no public entry exports them.

import ts from 'typescript';
import type { FileView } from '../reader/view.js';

/** Visits every node under `root`, `root` first, depth first. */
export function forEachNode(root: ts.Node, visit: (node: ts.Node) => void): void {
  const walk = (node: ts.Node): void => {
    visit(node);
    ts.forEachChild(node, walk);
  };
  walk(root);
}

/** The 1-based line a node starts on. */
export const lineOfNode = (file: FileView, node: ts.Node): number =>
  file.lineOf(node.getStart(file.sourceFile));

/** An expression with its parentheses, casts (`as`, `satisfies`, `<T>`), and non-null `!` taken off. */
export function unwrap(expression: ts.Expression): ts.Expression {
  let e = expression;
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isTypeAssertionExpression(e) ||
    ts.isNonNullExpression(e)
  ) {
    e = e.expression;
  }
  return e;
}

/** A string written whole: a quoted literal, or a backtick with no `${` hole. */
export const isPlainString = (
  node: ts.Node | undefined,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  !!node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));

/** The called function's own name: `f(…)` → `f`, `a.b.f(…)` → `f`; anything else → undefined. */
export function calleeName(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}
