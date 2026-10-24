import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { calleeName, forEachNode } from '../../support/ast.js';
import {
  anchoredFindings,
  anchoredProblems,
  type AnchoredEntry,
  type Occurrence,
} from '../../support/anchored-review.js';
import { namesProblem, objectProblem } from '../../support/facts.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

// Playwright's locator and page operations that act on the page: input, and navigation.
const PLAYWRIGHT_ACTIONS: ReadonlySet<string> = new Set([
  'check',
  'clear',
  'click',
  'dblclick',
  'dispatchEvent',
  'dragTo',
  'fill',
  'goBack',
  'goForward',
  'goto',
  'hover',
  'press',
  'pressSequentially',
  'reload',
  'selectOption',
  'selectText',
  'setChecked',
  'setInputFiles',
  'tap',
  'type',
  'uncheck',
]);

// Playwright's state reads: strict locators throw when a locator matches more than one element.
const STATE_PROBES: ReadonlySet<string> = new Set([
  'isChecked',
  'isDisabled',
  'isEditable',
  'isEnabled',
  'isHidden',
  'isVisible',
]);

const E2E_SCOPE: Scope = {
  roots: ['e2e', 'hostedE2e'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['hostedE2e'],
};

const actionNamesOf = (helpers: readonly string[]) => new Set([...PLAYWRIGHT_ACTIONS, ...helpers]);

const isFunctionNode = (node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node);

// `expect(fn).toPass(…)` and `expect.poll(fn)` retry `fn` until it passes.
function retriedCallbacks(sf: ts.SourceFile): Array<ts.ArrowFunction | ts.FunctionExpression> {
  const callbacks: Array<ts.ArrowFunction | ts.FunctionExpression> = [];
  forEachNode(sf, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    const method = node.expression.name.text;
    const target = node.expression.expression;
    if (method === 'toPass' && ts.isCallExpression(target)) {
      const fn = target.arguments[0];
      if (fn && isFunctionNode(fn) && calleeName(target)?.toLowerCase().endsWith('expect'))
        callbacks.push(fn);
    }
    if (method === 'poll' && calleeName(node) === 'poll') {
      const fn = node.arguments[0];
      if (fn && isFunctionNode(fn)) callbacks.push(fn);
    }
  });
  return callbacks;
}

export function retriedActions(
  source: FileView | string,
  helpers: readonly string[] = [],
): Occurrence[] {
  const file = typeof source === 'string' ? viewOfText('sample.spec.ts', source) : source;
  const sf = file.sourceFile;
  const actions = actionNamesOf(helpers);
  return retriedCallbacks(sf).flatMap((fn) => {
    let action: string | undefined;
    forEachNode(fn.body, (node) => {
      if (!action && ts.isCallExpression(node)) {
        const name = calleeName(node);
        if (name && actions.has(name)) action = name;
      }
    });
    return action
      ? [
          {
            start: fn.getStart(sf),
            end: fn.getEnd(),
            detail: `a retry loop repeats ${action}() until it passes`,
          },
        ]
      : [];
  });
}

function catchesRejection(handler: ts.Expression): boolean {
  if (!isFunctionNode(handler)) return true;
  let rethrows = false;
  forEachNode(handler.body, (node) => {
    if (ts.isThrowStatement(node)) rethrows = true;
  });
  return !rethrows;
}

// The call a `.catch()` is chained onto: `x.click().catch(…)` → `click`.
function caughtCallOf(
  catchCall: ts.CallExpression,
  names: ReadonlySet<string>,
): string | undefined {
  if (!ts.isPropertyAccessExpression(catchCall.expression)) return undefined;
  const receiver = catchCall.expression.expression;
  const call = ts.isParenthesizedExpression(receiver) ? receiver.expression : receiver;
  if (!ts.isCallExpression(call)) return undefined;
  const name = calleeName(call);
  return name && names.has(name) ? name : undefined;
}

export function swallowedActions(
  source: FileView | string,
  helpers: readonly string[] = [],
): Occurrence[] {
  const file = typeof source === 'string' ? viewOfText('sample.spec.ts', source) : source;
  const sf = file.sourceFile;
  const actions = actionNamesOf(helpers);
  const hits: Occurrence[] = [];
  forEachNode(sf, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch' &&
      node.arguments.length === 1 &&
      catchesRejection(node.arguments[0])
    ) {
      const action = caughtCallOf(node, actions);
      const probe = caughtCallOf(node, STATE_PROBES);
      if (action)
        hits.push({
          start: node.getStart(sf),
          end: node.getEnd(),
          detail: `a .catch() swallows a failed ${action}()`,
        });
      else if (probe)
        hits.push({
          start: node.getStart(sf),
          end: node.getEnd(),
          detail: `a .catch() turns a failed ${probe}() — an ambiguous locator included — into a value`,
        });
    }
    if (ts.isTryStatement(node) && node.catchClause) {
      let rethrows = false;
      forEachNode(node.catchClause.block, (inner) => {
        if (ts.isThrowStatement(inner)) rethrows = true;
      });
      if (rethrows) return;
      let action: string | undefined;
      forEachNode(node.tryBlock, (inner) => {
        if (!action && ts.isCallExpression(inner)) {
          const name = calleeName(inner);
          if (name && actions.has(name)) action = name;
        }
      });
      if (action)
        hits.push({
          start: node.getStart(sf),
          end: node.getEnd(),
          detail: `a try/catch swallows a failed ${action}()`,
        });
    }
  });
  return hits;
}

export interface E2eActionFacts {
  actionHelpers: readonly string[];
  reviewed: readonly AnchoredEntry[];
}

function e2eActionProblems(facts: E2eActionFacts): string[] {
  const problems: string[] = [];
  if (!objectProblem(facts, 'the facts', problems)) return problems;
  namesProblem(facts.actionHelpers, 'actionHelpers', problems, { nonEmpty: false });
  anchoredProblems(facts.reviewed, 'reviewed', problems);
  return problems;
}

export const retryLoopActionGuard: GenericGuardDefinition<E2eActionFacts> = {
  id: 'retryLoopActions',
  absentWhen: 'the repository has no end-to-end suite',
  absentOnlyWithoutRoot: 'e2e',
  factProblems: e2eActionProblems,
  build(facts) {
    return [
      {
        title: 'no end-to-end retry loop repeats a user action',
        description:
          'A toPass() or expect.poll() callback that clicks, types, or navigates repeats the action until it ' +
          'happens to work, so the failure a real user would hit passes as green (RULE-STD-QUALITY-003). Act once, ' +
          'then assert with a web-first assertion; a loop that only re-reads state is fine. The actions are ' +
          "Playwright's input and navigation calls plus the app's declared actionHelpers. A loop that must act — " +
          'polling a background result by reloading — is a reviewed entry whose anchor names that one loop, with ' +
          'its why; an entry that no longer matches a loop is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run: (context) =>
          anchoredFindings(
            context
              .files(E2E_SCOPE)
              .map((file) => ({ file, hits: retriedActions(file, facts.actionHelpers) })),
            facts.reviewed,
            'its anchor names no retry loop that acts',
          ),
      },
    ];
  },
};

export const swallowedActionGuard: GenericGuardDefinition<E2eActionFacts> = {
  id: 'swallowedE2eActions',
  absentWhen: 'the repository has no end-to-end suite',
  absentOnlyWithoutRoot: 'e2e',
  factProblems: e2eActionProblems,
  build(facts) {
    return [
      {
        title: 'no end-to-end action or state read swallows its failure',
        description:
          'A .catch() or a try/catch that discards a failed click, fill, or navigation lets the next step run on a ' +
          'page the action never reached, and one on isVisible(), isEnabled(), or isChecked() turns an ambiguous ' +
          '(strict-mode) locator into a silent "no". Let the failure throw: an action whose outcome is uncertain ' +
          "goes through the suite's outcome-verified helper, and a branch reads state with no catch. A catch that " +
          'must stay is a reviewed entry whose anchor names that one occurrence, with its why; an entry that no ' +
          'longer matches one is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run: (context) =>
          anchoredFindings(
            context
              .files(E2E_SCOPE)
              .map((file) => ({ file, hits: swallowedActions(file, facts.actionHelpers) })),
            facts.reviewed,
            'its anchor names no swallowed action or state read',
          ),
      },
    ];
  },
};
