import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { forEachNode } from '../../support/ast.js';
import {
  anchoredFindings,
  anchoredProblems,
  type AnchoredEntry,
  type Occurrence,
} from '../../support/anchored-review.js';
import { objectProblem } from '../../support/facts.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const SCOPE: Scope = {
  roots: ['app', 'functions', 'sharedSource', 'e2e', 'hostedE2e', 'scripts', 'workers'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['functions', 'sharedSource', 'e2e', 'hostedE2e', 'scripts', 'workers'],
};

const isCast = (node: ts.Node): node is ts.AsExpression | ts.TypeAssertion =>
  ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);

const isKeyword = (type: ts.TypeNode, kind: ts.SyntaxKind) => type.kind === kind;

export function blanketCasts(source: FileView | string): Occurrence[] {
  const file = typeof source === 'string' ? viewOfText('sample.ts', source) : source;
  const sf = file.sourceFile;
  const hits: Occurrence[] = [];
  forEachNode(sf, (node) => {
    if (!isCast(node)) return;
    if (isKeyword(node.type, ts.SyntaxKind.NeverKeyword))
      hits.push({
        start: node.getStart(sf),
        end: node.getEnd(),
        detail: 'an `as never` cast switches type checking off for the value',
      });
    else {
      let inner = node.expression;
      while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
      if (isCast(inner) && isKeyword(inner.type, ts.SyntaxKind.UnknownKeyword))
        hits.push({
          start: node.getStart(sf),
          end: node.getEnd(),
          detail: 'an `as unknown as` cast forces one type onto a value of another',
        });
    }
  });
  return hits;
}

export interface BlanketCastFacts {
  reviewed: readonly AnchoredEntry[];
}

export const blanketCastGuard: GenericGuardDefinition<BlanketCastFacts> = {
  id: 'blanketCasts',
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
        title: 'no cast switches type checking off',
        description:
          'An `as never` or `as unknown as X` cast tells the compiler to stop checking a value, so a wrong shape ' +
          'compiles and fails only at run time; the no-unsafe lint rules cannot see it. Give the value its real ' +
          'type: a typed fake or builder in a test, the owner type at a call site, a typed mapping between two ' +
          'unions. A cast that is the only way, or clearly the best way, is a reviewed entry whose anchor names ' +
          'that one cast, with its why; an entry that no longer matches a cast is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run: (context) =>
          anchoredFindings(
            context.files(SCOPE).map((file) => ({ file, hits: blanketCasts(file) })),
            facts.reviewed,
            'its anchor names no blanket cast',
          ),
      },
    ];
  },
};
