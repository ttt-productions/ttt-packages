// The guards over server-side Firestore writes and ids:
//   - inside a transaction callback, every read goes through the callback's transaction;
//   - no stored count is lowered by a blind negative increment;
//   - randomUUID appears only at reviewed sites that mint no document id;
//   - no Firestore Timestamp is minted with Timestamp.now().

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../suite/config.js';
import type { Scope } from '../../node/reader.js';
import type { Reviewed } from '../../node/layout.js';
import type { FileView } from '../../reader/view.js';
import { matchPattern, reviewedAllowlist } from '../../shapes/shapes.js';
import { calleeName, forEachNode } from '../../support/ast.js';
import { reviewedProblems, takesNoFacts } from '../../support/facts.js';
import { bannedGuard, type NoFacts, type NodeHit } from './support.js';

/** Every non-transactional read inside an inline `runTransaction` callback in one file. */
export function strayTransactionReads(file: FileView): NodeHit[] {
  const source = file.sourceFile;
  const hits: NodeHit[] = [];
  forEachNode(source, (node) => {
    if (!ts.isCallExpression(node) || calleeName(node) !== 'runTransaction') return;
    const callback = node.arguments.find((arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) as
      | ts.ArrowFunction
      | ts.FunctionExpression
      | undefined;
    if (!callback) return;
    const transaction = callback.parameters[0]?.name.getText(source);
    const inspect = (inner: ts.Node) => {
      if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression)) {
        const method = inner.expression.name.text;
        const receiver = inner.expression.expression.getText(source);
        if (((method === 'get' && inner.arguments.length === 0) || method === 'getAll') && receiver !== transaction) {
          hits.push({ node: inner, detail: `${receiver}.${method}(…) inside a runTransaction callback reads outside the transaction` });
        }
      }
      ts.forEachChild(inner, inspect);
    };
    ts.forEachChild(callback.body, inspect);
  });
  return hits;
}

export const transactionReadGuard: GenericGuardDefinition<NoFacts> = {
  id: 'firestoreTransactionReads',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems: takesNoFacts,
  build() {
    return [
      bannedGuard({
        title: 'a transaction callback reads only through its transaction',
        description:
          'Inside an inline runTransaction callback, every Firestore read goes through the callback transaction ' +
          '(transaction.get(ref | query), transaction.getAll(…)). A plain ref.get() / query.get() / db.getAll(…) there is ' +
          'outside the read set, so the write it decides can commit after the value changed. Fix: read through the ' +
          'transaction. A read made before the transaction, and a callback passed by name, are left to review.',
        scope: { roots: ['functions'], kinds: ['code'], tests: false },
        match: strayTransactionReads,
      }),
    ];
  },
};

function isNegative(arg: ts.Expression): boolean {
  if (ts.isPrefixUnaryExpression(arg) && arg.operator === ts.SyntaxKind.MinusToken) return true;
  return ts.isParenthesizedExpression(arg) ? isNegative(arg.expression) : false;
}

/** Every `….increment(<negative amount>)` in one file. */
export function negativeIncrements(file: FileView): NodeHit[] {
  const hits: NodeHit[] = [];
  forEachNode(file.sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'increment' &&
      node.arguments.length === 1 &&
      isNegative(node.arguments[0])
    ) {
      hits.push({ node, detail: `${node.getText(file.sourceFile).slice(0, 80)} lowers a count blind` });
    }
  });
  return hits;
}

export const counterDecrementGuard: GenericGuardDefinition<NoFacts> = {
  id: 'firestoreCounterDecrements',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems: takesNoFacts,
  build() {
    return [
      bannedGuard({
        title: 'no stored count is lowered by a blind decrement',
        description:
          'A count is lowered by reading it inside the transaction and writing the lowered value, never below zero — ' +
          'never by an increment of a negative amount, which drives a missing, already-zero, or twice-decremented count ' +
          'negative. Flagged: any .increment(-n) / .increment(-(…)) in server code and scripts. Fix: read the count in the ' +
          'transaction and write max(0, value - n), through that count\'s one decrement path.',
        scope: { roots: ['functions', 'scripts'], optionalRoots: ['functions', 'scripts'], kinds: ['code'], tests: false },
        match: negativeIncrements,
      }),
    ];
  },
};

export interface RandomUuidFacts {
  /** Server files reviewed to use randomUUID for something that is not a document id, each with its why. */
  reviewedSites: readonly Reviewed[];
}

export const randomUuidGuard: GenericGuardDefinition<RandomUuidFacts> = {
  id: 'firestoreRandomUuidSites',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.reviewedSites, 'reviewedSites', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title: 'randomUUID appears only at reviewed sites that mint no document id',
        description:
          'A Firestore document id comes from the auto-id a collection reference mints, never randomUUID. A ' +
          'non-persisted operation or request id, or a scratch file name, may use it; text cannot tell that use from a ' +
          'document id, so every server file that names randomUUID is a reviewed site with its why. Fix: mint the ' +
          'document id from the collection reference, or add the reviewed site. An entry whose file no longer names ' +
          'randomUUID is stale.',
        scope: { roots: ['functions'], kinds: ['code'], tests: false },
        match: matchPattern(/\brandomUUID\b/),
        allowlist: facts.reviewedSites,
        samples: {
          flags: ["import { randomUUID } from 'node:crypto';", 'const id = crypto.randomUUID();'],
          passes: ['// never a randomUUID for a document id\nconst ref = col.doc();', 'const id = ref.id;'],
        },
      }),
    ];
  },
};

const TIMESTAMP_NOW_SCOPE: Scope = { roots: ['app', 'functions'], optionalRoots: ['functions'], kinds: ['code'], tests: false };

/** Every `Timestamp.now(…)` (any receiver chain ending in `Timestamp`) in one file. */
export function timestampNowCalls(file: FileView): NodeHit[] {
  const hits: NodeHit[] = [];
  forEachNode(file.sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'now') return;
    const receiver = node.expression.expression;
    const name = ts.isIdentifier(receiver) ? receiver.text : ts.isPropertyAccessExpression(receiver) ? receiver.name.text : null;
    if (name === 'Timestamp') hits.push({ node, detail: `${node.getText(file.sourceFile)} mints a Firestore Timestamp` });
  });
  return hits;
}

export const timestampNowGuard: GenericGuardDefinition<NoFacts> = {
  id: 'firestoreTimestampNow',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems: takesNoFacts,
  build() {
    return [
      bannedGuard({
        title: 'no Firestore Timestamp is minted with Timestamp.now()',
        description:
          'A stored time is a Date.now() number, never a Firestore Timestamp. Flagged: Timestamp.now() on any receiver ' +
          '(Timestamp, admin.firestore.Timestamp, …) in app and server code. Fix: store Date.now().',
        scope: TIMESTAMP_NOW_SCOPE,
        match: timestampNowCalls,
      }),
    ];
  },
};
