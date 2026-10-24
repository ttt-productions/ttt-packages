import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { calleeName, forEachNode } from '../../support/ast.js';
import { resolveRelative } from '../../support/paths.js';
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

const isRepeatingLoop = (
  node: ts.Node,
): node is ts.ForStatement | ts.WhileStatement | ts.DoStatement =>
  ts.isForStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node);

type FunctionBodies = ReadonlyMap<string, readonly ts.Node[]>;

function functionBodiesOf(sf: ts.SourceFile): FunctionBodies {
  const bodies = new Map<string, ts.Node[]>();
  const add = (name: string, body: ts.Node) =>
    bodies.set(name, [...(bodies.get(name) ?? []), body]);
  forEachNode(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) add(node.name.text, node.body);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isFunctionNode(node.initializer)
    )
      add(node.name.text, node.initializer.body);
  });
  return bodies;
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function moduleCandidates(base: string): string[] {
  const stem = base.replace(/\.(?:[cm]?js|jsx)$/, '');
  return [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => stem + ext),
    ...SOURCE_EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
}

// Where an imported function lives: the file and the name it is declared under there.
function namedImportsOf(
  file: FileView,
  paths: ReadonlySet<string>,
): Map<string, { path: string; name: string }> {
  const imports = new Map<string, { path: string; name: string }>();
  for (const statement of file.sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const base = resolveRelative(file.path, statement.moduleSpecifier.text)?.path;
    const target = base && moduleCandidates(base).find((candidate) => paths.has(candidate));
    if (!target) continue;
    for (const element of bindings.elements)
      imports.set(element.name.text, {
        path: target,
        name: (element.propertyName ?? element.name).text,
      });
  }
  return imports;
}

// Finds the first action a piece of code performs, directly or through the plain function calls it
// makes into functions declared in the same file or imported from the suite's own files.
export interface ActionReach {
  actionIn(file: FileView, root: ts.Node): string[] | undefined;
}

export function createActionReach(
  files: readonly FileView[],
  helpers: readonly string[] = [],
): ActionReach {
  const actions = actionNamesOf(helpers);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const paths = new Set(byPath.keys());
  const bodiesCache = new Map<string, FunctionBodies>();
  const importsCache = new Map<string, Map<string, { path: string; name: string }>>();
  const bodiesOf = (file: FileView) => {
    let bodies = bodiesCache.get(file.path);
    if (!bodies) bodiesCache.set(file.path, (bodies = functionBodiesOf(file.sourceFile)));
    return bodies;
  };
  const importsOf = (file: FileView) => {
    let imports = importsCache.get(file.path);
    if (!imports) importsCache.set(file.path, (imports = namedImportsOf(file, paths)));
    return imports;
  };

  function search(file: FileView, root: ts.Node, seen: Set<string>): string[] | undefined {
    let found: string[] | undefined;
    forEachNode(root, (node) => {
      if (found || !ts.isCallExpression(node)) return;
      const name = calleeName(node);
      if (!name) return;
      if (actions.has(name)) {
        found = [name];
        return;
      }
      if (!ts.isIdentifier(node.expression)) return;
      const imported = importsOf(file).get(name);
      const local = bodiesOf(file).get(name);
      const owner = local ? file : imported ? byPath.get(imported.path) : undefined;
      const declared = local ? name : imported?.name;
      if (!owner || !declared) return;
      const key = `${owner.path}#${declared}`;
      if (seen.has(key)) return;
      seen.add(key);
      for (const body of bodiesOf(owner).get(declared) ?? []) {
        const inner = search(owner, body, seen);
        if (inner) {
          found = [name, ...inner];
          return;
        }
      }
    });
    return found;
  }

  return { actionIn: (file, root) => search(file, root, new Set()) };
}

// `['openWork', 'goto']` reads "goto() through openWork".
function describeAction(chain: readonly string[]): string {
  const action = `${chain[chain.length - 1]}()`;
  return chain.length > 1 ? `${action} through ${chain.slice(0, -1).join(' → ')}` : action;
}

const within = (inner: ts.Node, outer: ts.Node): boolean =>
  inner !== outer && inner.pos >= outer.pos && inner.end <= outer.end;

const viewOf = (source: FileView | string) =>
  typeof source === 'string' ? viewOfText('sample.spec.ts', source) : source;

export function retriedActions(
  source: FileView | string,
  helpers: readonly string[] = [],
  reach?: ActionReach,
): Occurrence[] {
  const file = viewOf(source);
  const sf = file.sourceFile;
  const reachFrom = reach ?? createActionReach([file], helpers);
  const loops: ts.Node[] = [];
  forEachNode(sf, (node) => {
    if (isRepeatingLoop(node)) loops.push(node);
  });
  const acting = [
    ...retriedCallbacks(sf).map((node) => ({
      node,
      body: node.body,
      kind: 'a retry loop',
      tail: ' until it passes',
    })),
    ...loops.map((node) => ({ node, body: node, kind: 'a for / while / do loop', tail: '' })),
  ].flatMap((loop) => {
    const chain = reachFrom.actionIn(file, loop.body);
    return chain ? [{ ...loop, chain }] : [];
  });
  return acting
    .filter((loop) => !acting.some((outer) => within(loop.node, outer.node)))
    .sort((a, b) => a.node.getStart(sf) - b.node.getStart(sf))
    .map((loop) => ({
      start: loop.node.getStart(sf),
      end: loop.node.getEnd(),
      detail: `${loop.kind} repeats ${describeAction(loop.chain)}${loop.tail}`,
    }));
}

function catchesRejection(handler: ts.Expression): boolean {
  if (!isFunctionNode(handler)) return true;
  let rethrows = false;
  forEachNode(handler.body, (node) => {
    if (ts.isThrowStatement(node)) rethrows = true;
  });
  return !rethrows;
}

// The call a `.catch()` is chained onto: `x.click().catch(…)` → the `click()` call.
function caughtCall(catchCall: ts.CallExpression): ts.CallExpression | undefined {
  if (!ts.isPropertyAccessExpression(catchCall.expression)) return undefined;
  const receiver = catchCall.expression.expression;
  const call = ts.isParenthesizedExpression(receiver) ? receiver.expression : receiver;
  return ts.isCallExpression(call) ? call : undefined;
}

export function swallowedActions(
  source: FileView | string,
  helpers: readonly string[] = [],
  reach?: ActionReach,
): Occurrence[] {
  const file = viewOf(source);
  const sf = file.sourceFile;
  const reachFrom = reach ?? createActionReach([file], helpers);
  const hits: Occurrence[] = [];
  forEachNode(sf, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch' &&
      node.arguments.length === 1 &&
      catchesRejection(node.arguments[0])
    ) {
      const call = caughtCall(node);
      if (!call) return;
      const name = calleeName(call);
      const chain = reachFrom.actionIn(file, call);
      if (chain)
        hits.push({
          start: node.getStart(sf),
          end: node.getEnd(),
          detail: `a .catch() swallows a failed ${describeAction(chain)}`,
        });
      else if (name && STATE_PROBES.has(name))
        hits.push({
          start: node.getStart(sf),
          end: node.getEnd(),
          detail: `a .catch() turns a failed ${name}() — an ambiguous locator included — into a value`,
        });
    }
    if (ts.isTryStatement(node) && node.catchClause) {
      let rethrows = false;
      forEachNode(node.catchClause.block, (inner) => {
        if (ts.isThrowStatement(inner)) rethrows = true;
      });
      if (rethrows) return;
      const chain = reachFrom.actionIn(file, node.tryBlock);
      if (chain)
        hits.push({
          start: node.getStart(sf),
          end: node.getEnd(),
          detail: `a try/catch swallows a failed ${describeAction(chain)}`,
        });
    }
  });
  return hits;
}

function withReach(
  files: readonly FileView[],
  helpers: readonly string[],
  find: (file: FileView, reach: ActionReach) => Occurrence[],
): Array<{ file: FileView; hits: Occurrence[] }> {
  const reach = createActionReach(files, helpers);
  return files.map((file) => ({ file, hits: find(file, reach) }));
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
          'A toPass() or expect.poll() callback, or a for (;;) / while / do loop, that clicks, types, or navigates ' +
          'repeats the action until it happens to work, so the failure a real user would hit passes as green ' +
          '(RULE-STD-QUALITY-003). Walking a list is written for…of, which is not a repeat. Act once, ' +
          'then assert with a web-first assertion; a loop that only re-reads state is fine. The actions are ' +
          "Playwright's input and navigation calls plus the app's declared actionHelpers, reached directly or through " +
          'a plain call to a function the suite declares in the same file or imports from its own files. A loop that must act — ' +
          'polling a background result by reloading — is a reviewed entry whose anchor names that one loop, with ' +
          'its why; an entry that no longer matches a loop is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run: (context) =>
          anchoredFindings(
            withReach(context.files(E2E_SCOPE), facts.actionHelpers, (file, reach) =>
              retriedActions(file, facts.actionHelpers, reach),
            ),
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
          'A .catch() or a try/catch that discards a failed click, fill, or navigation — made directly or through a plain ' +
          "call to one of the suite's own functions — lets the next step run on a " +
          'page the action never reached, and one on isVisible(), isEnabled(), or isChecked() turns an ambiguous ' +
          '(strict-mode) locator into a silent "no". Let the failure throw: an action whose outcome is uncertain ' +
          "goes through the suite's outcome-verified helper, and a branch reads state with no catch. A catch that " +
          'must stay is a reviewed entry whose anchor names that one occurrence, with its why; an entry that no ' +
          'longer matches one is stale.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run: (context) =>
          anchoredFindings(
            withReach(context.files(E2E_SCOPE), facts.actionHelpers, (file, reach) =>
              swallowedActions(file, facts.actionHelpers, reach),
            ),
            facts.reviewed,
            'its anchor names no swallowed action or state read',
          ),
      },
    ];
  },
};
