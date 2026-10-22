import ts from 'typescript';
import type { Finding, Guard } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { forEachNode, isPlainString, lineOfNode, unwrap } from '../../support/ast.js';

export type NoFacts = Readonly<Record<string, never>>;

export interface NodeHit {
  node: ts.Node;
  detail: string;
}

export const findingsOf = (file: FileView, hits: readonly NodeHit[]): Finding[] =>
  [...hits]
    .sort((a, b) => a.node.getStart(file.sourceFile) - b.node.getStart(file.sourceFile))
    .map((hit) => ({ file: file.path, line: lineOfNode(file, hit.node), detail: hit.detail }));

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

export function literalBindings(source: ts.SourceFile): Map<string, string> {
  const names = new Map<string, string>();
  forEachNode(source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = unwrap(node.initializer);
      if (isPlainString(value)) names.set(node.name.text, value.text);
    }
  });
  return names;
}

export function isMemberOf(node: ts.Node, roots: ReadonlySet<string>): boolean {
  let current: ts.Node = node;
  if (!ts.isPropertyAccessExpression(current) && !ts.isElementAccessExpression(current))
    return false;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
    current = current.expression;
  return ts.isIdentifier(current) && roots.has(current.text);
}

export function literalText(node: ts.Node): string | null {
  if (isPlainString(node)) return node.text;
  if (ts.isTemplateExpression(node))
    return node.head.text + node.templateSpans.map((s) => s.literal.text).join('');
  return null;
}
