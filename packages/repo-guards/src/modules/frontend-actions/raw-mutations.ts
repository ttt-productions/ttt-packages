import ts from 'typescript';
import type { FileView } from '../../reader/view.js';
import type { Hit } from '../../shapes/shapes.js';
import { forEachNode } from '../../support/ast.js';
import { MODULE_LOADS, moduleImports } from '../../support/imports.js';

const RAW_HOOK = 'useMutation';
const RAW_MODULE = /^@tanstack\/[\w-]+(?:\/|$)/;

const bindsRawHook = (pattern: ts.ObjectBindingPattern): boolean =>
  pattern.elements.some(
    (el) =>
      !el.dotDotDotToken &&
      (el.propertyName ?? el.name).getText(pattern.getSourceFile()) === RAW_HOOK,
  );

const namesRawHook = (node: ts.Node): boolean =>
  (ts.isPropertyAccessExpression(node) && node.name.text === RAW_HOOK) ||
  (ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === RAW_HOOK);

function climbLoad(node: ts.Node): ts.Node {
  let at = node;
  while (
    ts.isAwaitExpression(at.parent) ||
    ts.isParenthesizedExpression(at.parent) ||
    ts.isAsExpression(at.parent) ||
    ts.isNonNullExpression(at.parent)
  )
    at = at.parent;
  return at;
}

function loadedUse(load: ts.Node, namespaces: Set<string>): boolean {
  const at = climbLoad(load);
  const parent = at.parent;
  if (namesRawHook(parent) && (parent as ts.AccessExpression).expression === at) return true;
  if (ts.isVariableDeclaration(parent) && parent.initializer === at) {
    if (ts.isObjectBindingPattern(parent.name)) return bindsRawHook(parent.name);
    if (ts.isIdentifier(parent.name)) namespaces.add(parent.name.text);
    return false;
  }
  if (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === at &&
    parent.name.text === 'then' &&
    ts.isCallExpression(parent.parent)
  ) {
    const callback = parent.parent.arguments[0];
    const param =
      callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
        ? callback.parameters[0]?.name
        : undefined;
    if (param && ts.isObjectBindingPattern(param)) return bindsRawHook(param);
    if (param && ts.isIdentifier(param)) namespaces.add(param.text);
  }
  return false;
}

export function rawMutations(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  const namespaces = new Set<string>();
  for (const site of moduleImports(sf, MODULE_LOADS)) {
    if (!RAW_MODULE.test(site.spec) || site.typeOnly) continue;
    const index = site.node.getStart(sf);
    for (const name of site.named)
      if (name.imported === RAW_HOOK && !name.typeOnly)
        hits.push({ index, detail: `${RAW_HOOK} from ${site.spec}` });
    if (site.kind === 'export' && site.star)
      hits.push({
        index,
        detail: site.namespace
          ? `export * as ${site.namespace} from ${site.spec}`
          : `export * from ${site.spec}`,
      });
    else if (site.namespace) namespaces.add(site.namespace);
    else if (
      (site.kind === 'dynamic' || site.kind === 'require') &&
      loadedUse(site.node, namespaces)
    )
      hits.push({ index, detail: `${site.kind} load of ${site.spec} for ${RAW_HOOK}` });
  }
  if (namespaces.size) {
    const isNamespace = (node: ts.Expression) => ts.isIdentifier(node) && namespaces.has(node.text);
    forEachNode(sf, (node) => {
      if (namesRawHook(node) && isNamespace((node as ts.AccessExpression).expression))
        hits.push({
          index: node.getStart(sf),
          detail: `${(node as ts.AccessExpression).expression.getText(sf)}.${RAW_HOOK}`,
        });
      else if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        isNamespace(node.initializer) &&
        bindsRawHook(node.name)
      )
        hits.push({
          index: node.getStart(sf),
          detail: `${RAW_HOOK} destructured from ${node.initializer.getText(sf)}`,
        });
    });
  }
  return hits.sort((a, b) => a.index - b.index);
}
