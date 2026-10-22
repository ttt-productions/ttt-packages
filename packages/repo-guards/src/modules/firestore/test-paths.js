import ts from 'typescript';
import { isPlainString } from '../../support/ast.js';
import { escapeRegExp } from '../../support/text.js';

const SEGMENT_CALLS = new Set(['doc', 'collection', 'collectionGroup']);

const scriptKindOf = (file) =>
  file.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : file.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : /\.(m|c)?js$/.test(file)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;

/**
 * @param {Array<{ path: string, content: string, sourceFile?: import('typescript').SourceFile }>} files
 * @param {{ collectionNames: readonly string[] }} options
 * @returns {string[]}
 */
export function findHandTypedFirestorePaths(files, { collectionNames }) {
  const names = [...new Set(collectionNames)].filter((name) => typeof name === 'string' && name);
  if (!names.length)
    throw new Error('repo-guards: findHandTypedFirestorePaths needs the core collection names');
  const declared = new Set(names);
  const handTypedPath = new RegExp(`^(?:${names.map(escapeRegExp).join('|')})/`);
  const offenders = [];
  for (const { path, content, sourceFile } of files) {
    const source =
      sourceFile ??
      ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKindOf(path));
    const report = (node) =>
      offenders.push(
        `${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
      );
    const visit = (node) => {
      const plain = isPlainString(node);
      const opening = plain ? node.text : ts.isTemplateExpression(node) ? node.head.text : null;
      if (opening !== null && handTypedPath.test(opening)) {
        report(node);
      } else if (
        plain &&
        declared.has(node.text) &&
        ts.isCallExpression(node.parent) &&
        node.parent.arguments.includes(node)
      ) {
        const callee = node.parent.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : null;
        if (name && SEGMENT_CALLS.has(name)) report(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return offenders;
}
