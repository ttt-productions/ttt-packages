import ts from 'typescript';
import { forEachNode, unwrap } from './ast.js';

export type Factory = ts.ArrowFunction | ts.FunctionExpression;

export function factoryFunction(factory: ts.Expression): Factory | null {
  const value = unwrap(factory);
  return ts.isArrowFunction(value) || ts.isFunctionExpression(value) ? value : null;
}

// The runner's options object (`{ spy: true }`) in the factory's place mocks the module itself.
export const isRunnerOptions = (factory: ts.Expression): boolean =>
  ts.isObjectLiteralExpression(unwrap(factory));

export function returnedExpressions(fn: Factory): Array<ts.Expression | null> {
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out: Array<ts.Expression | null> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) out.push(node.expression ?? null);
    ts.forEachChild(node, visit);
  };
  fn.body.statements.forEach(visit);
  return out;
}

export const awaited = (expression: ts.Expression): ts.Expression => {
  const value = unwrap(expression);
  return ts.isAwaitExpression(value) ? unwrap(value.expression) : value;
};

export function importedSpecifier(expression: ts.Expression): string | null {
  const value = awaited(expression);
  if (!ts.isCallExpression(value) || value.expression.kind !== ts.SyntaxKind.ImportKeyword)
    return null;
  const [spec] = value.arguments;
  return spec && ts.isStringLiteralLike(spec) ? spec.text : null;
}

export const parameterName = (fn: Factory): string | null => {
  const [first] = fn.parameters;
  return first && ts.isIdentifier(first.name) ? first.name.text : null;
};

export interface Binding {
  path: string;
  name: string | null;
}

export function bindingsOf(fn: Factory, resolve: (spec: string) => string): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  if (!ts.isBlock(fn.body)) return bindings;
  forEachNode(fn.body, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) return;
    const spec = importedSpecifier(node.initializer);
    if (spec === null) return;
    const path = resolve(spec);
    if (ts.isIdentifier(node.name)) bindings.set(node.name.text, { path, name: null });
    else if (ts.isObjectBindingPattern(node.name))
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const imported = element.propertyName ?? element.name;
        if (ts.isIdentifier(imported))
          bindings.set(element.name.text, { path, name: imported.text });
      }
  });
  return bindings;
}

export function calledExport(
  call: ts.CallExpression,
  bindings: Map<string, Binding>,
  resolve: (spec: string) => string,
): { path: string; name: string } | null {
  const callee = unwrap(call.expression);
  if (ts.isPropertyAccessExpression(callee)) {
    const spec = importedSpecifier(callee.expression);
    if (spec !== null) return { path: resolve(spec), name: callee.name.text };
    const base = unwrap(callee.expression);
    if (!ts.isIdentifier(base)) return null;
    const bound = bindings.get(base.text);
    return bound && bound.name === null ? { path: bound.path, name: callee.name.text } : null;
  }
  if (ts.isIdentifier(callee)) {
    const bound = bindings.get(callee.text);
    return bound && bound.name !== null ? { path: bound.path, name: bound.name } : null;
  }
  return null;
}
