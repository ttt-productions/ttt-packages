import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type AllowlistEntry, type Hit } from '../../shapes/shapes.js';
import { allowlistProblems, objectProblem } from '../../support/facts.js';
import { isUnder } from '../../support/text.js';
import { APP_CODE, filesUnder, identifierListProblem, pathListProblem } from './shared.js';

export interface PagesNeverMoveFacts {
  surfaceTrees: readonly string[];
  gateComponents: readonly string[];
  readStateComponents: readonly string[];
  pendingSignals: readonly string[];
  exceptions: {
    nullArms: readonly AllowlistEntry[];
    emptyNull: readonly AllowlistEntry[];
    latches: readonly AllowlistEntry[];
    unansweredShowing: readonly AllowlistEntry[];
  };
}

const unwrapped = (node: ts.Expression): ts.Expression => {
  let e = node;
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e))
    e = e.expression;
  return e;
};

const isNullLiteral = (node: ts.Expression): boolean =>
  unwrapped(node).kind === ts.SyntaxKind.NullKeyword;

const isNullish = (node: ts.Expression): boolean => {
  const e = unwrapped(node);
  return e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === 'undefined');
};

function tagName(node: ts.JsxOpeningLikeElement): string {
  const tag = node.tagName;
  return ts.isPropertyAccessExpression(tag) ? tag.name.text : tag.getText();
}

function ownBody(fn: ts.SignatureDeclaration, visit: (node: ts.Node) => void): void {
  const walk = (node: ts.Node): void => {
    if (node !== fn && ts.isFunctionLike(node)) return;
    visit(node);
    ts.forEachChild(node, walk);
  };
  const body = (fn as ts.FunctionLikeDeclarationBase).body;
  if (body) walk(body);
}

function rendersGate(node: ts.Node, gates: ReadonlySet<string>): boolean {
  let found = false;
  const walk = (n: ts.Node): void => {
    if (found || ts.isFunctionLike(n)) return;
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && gates.has(tagName(n)))
      found = true;
    else ts.forEachChild(n, walk);
  };
  walk(node);
  return found;
}

function functionsOf(sf: ts.SourceFile): ts.SignatureDeclaration[] {
  const out: ts.SignatureDeclaration[] = [];
  const walk = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)) &&
      node.body
    )
      out.push(node);
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

export function nullArmsBesideGates(file: FileView, gates: ReadonlySet<string>): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  for (const fn of functionsOf(sf)) {
    const returned: ts.Expression[] = [];
    const body = (fn as ts.FunctionLikeDeclarationBase).body;
    if (body && !ts.isBlock(body)) returned.push(body);
    ownBody(fn, (node) => {
      if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
    });
    const arms: ts.Expression[] = [];
    for (const expression of returned) {
      const e = unwrapped(expression);
      if (ts.isConditionalExpression(e)) arms.push(e.whenTrue, e.whenFalse);
      else arms.push(e);
    }
    const nullArm = arms.find(isNullLiteral);
    if (nullArm && arms.some((arm) => !isNullLiteral(arm) && rendersGate(arm, gates)))
      hits.push({
        index: nullArm.getStart(sf),
        detail: 'renders a loading or read-state arm, and nothing (null) in another arm',
      });
  }
  return hits.sort((a, b) => a.index - b.index);
}

export function emptyNullProps(file: FileView, readStates: ReadonlySet<string>): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  const walk = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      readStates.has(tagName(node))
    ) {
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(sf) === 'empty' &&
          attribute.initializer &&
          ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression &&
          isNullLiteral(attribute.initializer.expression)
        )
          hits.push({
            index: attribute.getStart(sf),
            detail: `<${tagName(node)} empty={null}> draws nothing once its read answers empty`,
          });
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return hits;
}

const isTrue = (node: ts.Expression | undefined): boolean =>
  node !== undefined && unwrapped(node).kind === ts.SyntaxKind.TrueKeyword;

export function renderPhaseLatches(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  const setterCalls = new Map<string, ts.CallExpression[]>();
  const collect = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const calls = setterCalls.get(node.expression.text) ?? [];
      calls.push(node);
      setterCalls.set(node.expression.text, calls);
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);
  for (const fn of functionsOf(sf)) {
    const latchSetters = new Set<string>();
    ownBody(fn, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isArrayBindingPattern(node.name) &&
        node.initializer &&
        ts.isCallExpression(unwrapped(node.initializer))
      ) {
        const call = unwrapped(node.initializer) as ts.CallExpression;
        const callee = call.expression.getText(sf).replace(/^React\./, '');
        const [initial] = call.arguments;
        const setter = node.name.elements[1];
        if (
          callee === 'useState' &&
          initial !== undefined &&
          unwrapped(initial).kind === ts.SyntaxKind.FalseKeyword &&
          setter &&
          ts.isBindingElement(setter) &&
          ts.isIdentifier(setter.name)
        )
          latchSetters.add(setter.name.text);
      }
    });
    for (const setter of latchSetters) {
      const calls = setterCalls.get(setter) ?? [];
      if (!calls.every((call) => isTrue(call.arguments[0]))) continue;
      ownBody(fn, (node) => {
        if (calls.includes(node as ts.CallExpression))
          hits.push({
            index: node.getStart(sf),
            detail: `${setter}(true) during render latches a section shown across a read`,
          });
      });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

function unansweredOperand(node: ts.Expression, signals: ReadonlySet<string>): boolean {
  const e = unwrapped(node);
  if (!ts.isBinaryExpression(e)) return false;
  const op = e.operatorToken.kind;
  if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.EqualsEqualsToken)
    return false;
  const [read, other] = isNullish(e.right) ? [e.left, e.right] : [e.right, e.left];
  if (!isNullish(other)) return false;
  const r = unwrapped(read);
  const name = ts.isPropertyAccessExpression(r)
    ? r.name.text
    : ts.isIdentifier(r)
      ? r.text
      : undefined;
  return name !== undefined && signals.has(name);
}

function orOperands(node: ts.Expression): ts.Expression[] {
  const e = unwrapped(node);
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    return [...orOperands(e.left), ...orOperands(e.right)];
  return [e];
}

export function unansweredCountedShowing(file: FileView, signals: ReadonlySet<string>): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  for (const fn of functionsOf(sf)) {
    const returned: ts.Expression[] = [];
    const body = (fn as ts.FunctionLikeDeclarationBase).body;
    if (body && !ts.isBlock(body)) returned.push(body);
    ownBody(fn, (node) => {
      if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
    });
    for (const expression of returned) {
      const operands = orOperands(expression);
      if (operands.length < 2) continue;
      const unanswered = operands.find((operand) => unansweredOperand(operand, signals));
      if (unanswered)
        hits.push({
          index: unanswered.getStart(sf),
          detail: `${unanswered.getText(sf)} || … counts a read that has not answered as showing`,
        });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export const pagesNeverMoveGuard: GenericGuardDefinition<PagesNeverMoveFacts> = {
  id: 'pagesNeverMove',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathListProblem(facts?.surfaceTrees, 'surfaceTrees', problems);
    identifierListProblem(facts?.gateComponents, 'gateComponents', problems, { nonEmpty: true });
    identifierListProblem(facts?.readStateComponents, 'readStateComponents', problems, {
      nonEmpty: true,
    });
    identifierListProblem(facts?.pendingSignals, 'pendingSignals', problems, { nonEmpty: true });
    if (objectProblem(facts?.exceptions, 'exceptions', problems)) {
      allowlistProblems(facts.exceptions.nullArms, 'exceptions.nullArms', problems);
      allowlistProblems(facts.exceptions.emptyNull, 'exceptions.emptyNull', problems);
      allowlistProblems(facts.exceptions.latches, 'exceptions.latches', problems);
      allowlistProblems(
        facts.exceptions.unansweredShowing,
        'exceptions.unansweredShowing',
        problems,
      );
    }
    return problems;
  },
  build(facts) {
    const inTrees = (file: FileView) => facts.surfaceTrees.some((tree) => isUnder(file.path, tree));
    const gates = new Set(facts.gateComponents);
    const readStates = new Set(facts.readStateComponents);
    const signals = new Set(facts.pendingSignals);
    const sample = `${facts.surfaceTrees[0]}/sample.tsx`;
    const [gate] = facts.gateComponents;
    const [readState] = facts.readStateComponents;
    const [signal] = facts.pendingSignals;
    const trees = facts.surfaceTrees.join(', ');
    const reviewed = 'A reviewed exception names the file and its why.';
    const guards = [
      reviewedAllowlist({
        title:
          'a component that renders a loading or read-state arm never renders nothing in another',
        description:
          `In a render surface (${trees}), a component that renders a loading or read-state arm ` +
          `(${facts.gateComponents.join(' / ')}) never returns null in another arm: a section shown pending and then ` +
          'drawn as nothing collapses under the reader once its read answers. A section whose presence depends on a ' +
          `read is decided in the page's one gate, before the page draws (RULE-STD-FRONTEND-208). ${reviewed}`,
        scope: APP_CODE,
        match: (file) => (inTrees(file) ? nullArmsBesideGates(file, gates) : []),
        allowlist: facts.exceptions.nullArms,
        samples: {
          flags: [
            {
              path: sample,
              text: `export function Strip() {\n  const rows = useRows();\n  if (rows.${signal}?.length === 0) return null;\n  return <${gate} />;\n}`,
            },
            {
              path: sample,
              text: `export const Strip = ({ open }: { open: boolean }) => (open ? <${gate} /> : null);`,
            },
          ],
          passes: [
            {
              path: sample,
              text: `export function Strip() {\n  const rows = useRows();\n  if (rows.${signal} === undefined) return <${gate} />;\n  return <List rows={rows.${signal}} />;\n}`,
            },
            {
              path: sample,
              text: `export function Strip() {\n  return <List onEmpty={() => null} />;\n}`,
            },
          ],
        },
      }),
      reviewedAllowlist({
        title: 'a read-state never draws nothing for an answered empty read',
        description:
          `In a render surface (${trees}), a read-state component (${facts.readStateComponents.join(' / ')}) never takes ` +
          'empty={null}: the section it holds shows pending, then vanishes once the read answers empty. An empty ' +
          `answer draws the canonical empty state, or the read joins the page's gate (RULE-STD-FRONTEND-208). ${reviewed}`,
        scope: APP_CODE,
        match: (file) => (inTrees(file) ? emptyNullProps(file, readStates) : []),
        allowlist: facts.exceptions.emptyNull,
        samples: {
          flags: [
            { path: sample, text: `const view = <${readState} read={rows} empty={null} />;` },
          ],
          passes: [
            {
              path: sample,
              text: `const view = <${readState} read={rows} empty={<EmptyState />} />;`,
            },
          ],
        },
      }),
      reviewedAllowlist({
        title: 'no render-phase useState latch holds a section across a read',
        description:
          `In a render surface (${trees}), no component sets a useState(false) flag to true during render and never ` +
          'back: such a latch holds a section shown, or hidden, by what a read once said rather than what it says, so ' +
          `the page decides what exists after it draws (RULE-STD-FRONTEND-208). ${reviewed}`,
        scope: APP_CODE,
        match: (file) => (inTrees(file) ? renderPhaseLatches(file) : []),
        allowlist: facts.exceptions.latches,
        samples: {
          flags: [
            {
              path: sample,
              text: 'export function Doors() {\n  const [appeared, setAppeared] = useState(false);\n  if (shows && !appeared) setAppeared(true);\n  return appeared ? <Doors /> : null;\n}',
            },
          ],
          passes: [
            {
              path: sample,
              text: 'export function Doors() {\n  const [open, setOpen] = useState(false);\n  return <button onClick={() => setOpen(true)}>Open</button>;\n}',
            },
            {
              path: sample,
              text: 'export function Doors({ live }: { live: boolean }) {\n  const [held, setHeld] = useState(false);\n  if (held !== live) setHeld(live);\n  return <Doors held={held} />;\n}',
            },
          ],
        },
      }),
      reviewedAllowlist({
        title: 'a predicate never counts a read that has not answered as showing',
        description:
          `In a render surface (${trees}), a predicate that returns an || chain never counts a read that has not ` +
          `answered (${facts.pendingSignals.map((s) => `${s} === undefined`).join(' / ')}) as a reason to show: an ` +
          `unknown read neither shows a section nor hides it (RULE-STD-FRONTEND-206, RULE-STD-FRONTEND-208). ${reviewed}`,
        scope: APP_CODE,
        match: (file) => (inTrees(file) ? unansweredCountedShowing(file, signals) : []),
        allowlist: facts.exceptions.unansweredShowing,
        samples: {
          flags: [
            {
              path: sample,
              text: `export function listShows(read: Read) {\n  return read.${signal} === undefined || read.${signal}.length > 0;\n}`,
            },
          ],
          passes: [
            {
              path: sample,
              text: `export function listShows(read: Read) {\n  return read.${signal} !== undefined && read.${signal}.length > 0;\n}`,
            },
            {
              path: sample,
              text: `export function rowsOf(read: Read) {\n  if (read.${signal} === undefined || read.${signal}.length === 0) return [];\n  return read.${signal};\n}`,
            },
          ],
        },
      }),
    ];
    return guards.map((guard) => ({
      ...guard,
      async run(context) {
        return [...filesUnder(context, facts.surfaceTrees).findings, ...(await guard.run(context))];
      },
    }));
  },
};
