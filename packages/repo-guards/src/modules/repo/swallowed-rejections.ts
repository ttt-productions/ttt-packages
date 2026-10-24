import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { forEachNode } from '../../support/ast.js';
import { objectProblem, reviewedProblems } from '../../support/facts.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const isEmptyHandler = (handler: ts.Expression): boolean => {
  if (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler)) return false;
  const { body } = handler;
  if (ts.isBlock(body)) return body.statements.length === 0;
  const value = ts.isParenthesizedExpression(body) ? body.expression : body;
  return (
    (ts.isIdentifier(value) && value.text === 'undefined') ||
    value.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isVoidExpression(value) && ts.isNumericLiteral(value.expression))
  );
};

const STATEMENT_HOLDERS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.SourceFile,
  ts.SyntaxKind.Block,
  ts.SyntaxKind.ModuleBlock,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.DefaultClause,
]);

function statementOf(node: ts.Node): ts.Node {
  let at = node;
  while (at.parent && !STATEMENT_HOLDERS.has(at.parent.kind)) at = at.parent;
  return at;
}

function commentLines(file: FileView): Set<number> {
  const lines = new Set<number>();
  const text = file.text.split('\n');
  const code = file.code.split('\n');
  for (let i = 0; i < text.length; i += 1) if (text[i] !== code[i]) lines.add(i + 1);
  return lines;
}

export interface SwallowedRejection {
  index: number;
  detail: string;
}

export function swallowedRejections(source: FileView | string): SwallowedRejection[] {
  const file = typeof source === 'string' ? viewOfText('sample.ts', source) : source;
  const sf = file.sourceFile;
  const hits: SwallowedRejection[] = [];
  let commented: Set<number> | null = null;
  forEachNode(sf, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== 'catch' ||
      node.arguments.length !== 1 ||
      !isEmptyHandler(node.arguments[0])
    )
      return;
    commented ??= commentLines(file);
    const from = file.lineOf(statementOf(node).getStart(sf)) - 1;
    const to = file.lineOf(node.getEnd());
    for (let line = from; line <= to; line += 1) if (commented.has(line)) return;
    hits.push({
      index: node.expression.name.getStart(sf),
      detail: 'a .catch() discards the rejection with no reason',
    });
  });
  return hits;
}

const SCOPE: Scope = {
  roots: ['app', 'functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
};

export interface SwallowedRejectionFacts {
  reviewed: ReadonlyArray<{ path: string; why: string }>;
}

export const swallowedRejectionGuard: GenericGuardDefinition<SwallowedRejectionFacts> = {
  id: 'swallowedRejections',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'the facts', problems)) return problems;
    reviewedProblems(facts.reviewed, 'reviewed', problems);
    return problems;
  },
  build(facts) {
    const reviewed = new Map(facts.reviewed.map((entry) => [entry.path, entry]));
    return [
      {
        title: 'no promise rejection is discarded without a reason',
        description:
          'A .catch() whose handler does nothing — an empty body, or one that returns undefined, void 0, or null — ' +
          'throws the failure away, and lint sees only empty catch blocks. Handle the rejection, or, where discarding ' +
          'it is right, say why in a one-line comment on the line above the statement, on the .catch() line, or ' +
          'inside the handler. A file that must discard rejections with no comment is a reviewed entry with its why; ' +
          'an entry whose file no longer does is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const findings: Finding[] = [];
          const seen = new Set<string>();
          for (const file of context.files(SCOPE)) {
            const hits = swallowedRejections(file);
            if (!hits.length) continue;
            if (reviewed.has(file.path)) {
              seen.add(file.path);
              continue;
            }
            for (const hit of hits)
              findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail });
          }
          for (const path of reviewed.keys())
            if (!seen.has(path))
              findings.push({
                file: path,
                detail:
                  'stale reviewed entry: the file no longer discards a rejection without a reason',
              });
          return findings;
        },
      },
    ];
  },
};
