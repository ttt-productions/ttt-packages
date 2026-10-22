import ts from 'typescript';
import type { FileView } from '../../reader/view.js';
import { isPlainString } from '../../support/ast.js';

export interface CodeString {
  text: string;
  index: number;
}

export function codeStrings(file: FileView): CodeString[] {
  const out: CodeString[] = [];
  const sf = file.sourceFile;
  const visit = (node: ts.Node): void => {
    if (isPlainString(node)) {
      out.push({ text: node.text, index: node.getStart(sf) });
      return;
    }
    if (ts.isTemplateExpression(node)) {
      out.push({
        text: [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' '),
        index: node.getStart(sf),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export const tokensOf = (text: string): string[] => text.split(/\s+/).filter(Boolean);

export const bareToken = (token: string): string => token.replace(/^(?:[\w-]+:|\[[^\]]+\]:)+/, '');

export interface JsxElementSpan {
  name: string;
  start: number;
  end: number;
}

export function jsxElements(file: FileView): JsxElementSpan[] {
  const out: JsxElementSpan[] = [];
  const sf = file.sourceFile;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node))
      out.push({
        name: node.openingElement.tagName.getText(sf),
        start: node.getStart(sf),
        end: node.getEnd(),
      });
    else if (ts.isJsxSelfClosingElement(node))
      out.push({ name: node.tagName.getText(sf), start: node.getStart(sf), end: node.getEnd() });
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export function exportedNames(file: FileView): Set<string> {
  const out = new Set<string>();
  for (const statement of file.sourceFile.statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const e of statement.exportClause.elements) out.add(e.name.text);
    }
    if (!exported) continue;
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name)
      out.add(statement.name.text);
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations)
        if (ts.isIdentifier(d.name)) out.add(d.name.text);
    }
  }
  return out;
}
