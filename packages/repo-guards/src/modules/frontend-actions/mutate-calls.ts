import ts from 'typescript';
import type { FileView } from '../../reader/view.js';
import type { Hit } from '../../shapes/shapes.js';
import { forEachNode } from '../../support/ast.js';

const FIRE_AND_FORGET = 'mutate';

const bindingName = (el: ts.BindingElement, sf: ts.SourceFile): string =>
  (el.propertyName ?? el.name).getText(sf);

export function mutateCalls(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  forEachNode(sf, (node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === FIRE_AND_FORGET)
      hits.push({ index: node.name.getStart(sf), detail: `${node.expression.getText(sf)}.mutate` });
    else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === FIRE_AND_FORGET
    )
      hits.push({ index: node.getStart(sf), detail: `${node.expression.getText(sf)}['mutate']` });
    else if (
      ts.isBindingElement(node) &&
      !node.dotDotDotToken &&
      ts.isObjectBindingPattern(node.parent) &&
      bindingName(node, sf) === FIRE_AND_FORGET
    )
      hits.push({
        index: node.getStart(sf),
        detail: `mutate destructured as ${node.name.getText(sf)}`,
      });
  });
  return hits.sort((a, b) => a.index - b.index);
}
