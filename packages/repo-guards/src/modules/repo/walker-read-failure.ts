// A walker that catches a directory-read failure and answers "no entries" turns an unreadable
// subtree into a clean pass. The reader fails closed, but it cannot stop a hand-written walk in the
// app's own code, so every directory read there must throw on failure. There is no allowlist.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { takesNoFacts } from '../../support/facts.js';

const DIRECTORY_READS = new Set(['readdirSync', 'readdir', 'opendirSync', 'opendir']);

const calledName = (node: ts.CallExpression): string | null =>
  ts.isIdentifier(node.expression)
    ? node.expression.text
    : ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : null;

const isDirectoryRead = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && DIRECTORY_READS.has(calledName(node) ?? '');

function contains(root: ts.Node, test: (node: ts.Node) => boolean): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (test(node)) found = true;
    else ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/** A handler that rethrows: it holds a `throw`, or it returns a rejected promise. */
const rethrows = (handler: ts.Node) =>
  contains(handler, (node) => ts.isThrowStatement(node)) ||
  contains(
    handler,
    (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Promise' &&
      node.expression.name.text === 'reject',
  );

/**
 * Where a file swallows a directory-read failure: a `try` holding a directory read whose `catch`
 * never rethrows, or a directory read's promise given a `.catch` handler that never rethrows.
 */
export function swallowedDirectoryReads(file: FileView): number[] {
  const sourceFile = file.sourceFile;
  const hits: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isTryStatement(node) && node.catchClause && contains(node.tryBlock, isDirectoryRead) && !rethrows(node.catchClause.block)) {
      hits.push(node.catchClause.getStart(sourceFile));
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch' &&
      contains(node.expression.expression, isDirectoryRead) &&
      node.arguments.length > 0 &&
      !rethrows(node.arguments[0])
    ) {
      hits.push(node.expression.name.getStart(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return hits;
}

const SCOPE: Scope = { roots: ['app', 'functions', 'scripts'], kinds: ['code'], tests: true, optionalRoots: ['functions', 'scripts'] };

/** Takes no facts: it reads the app, Functions and scripts roots the layout declares. */
export type WalkerReadFailureFacts = Readonly<Record<string, never>>;

export const walkerReadFailureGuard: GenericGuardDefinition<WalkerReadFailureFacts> = {
  id: 'walkerReadFailure',
  absentWhen: false,
  factProblems: takesNoFacts,
  build() {
    return [
      {
        title: 'no directory walker turns an unreadable folder into an empty answer',
        description:
          'A directory read (readdir, readdirSync, opendir, opendirSync) inside a try must not be caught by a handler that ' +
          'returns, continues, or carries on without rethrowing, and its promise must not be given a .catch that does the ' +
          'same: an unreadable folder then reads as an empty one and every check over it passes. Let the failure throw, ' +
          'or rethrow it naming the folder.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          for (const file of context.files(SCOPE)) {
            for (const index of swallowedDirectoryReads(file)) {
              findings.push({ file: file.path, line: file.lineOf(index), detail: 'a directory-read failure is swallowed' });
            }
          }
          return findings;
        },
      },
    ];
  },
};
