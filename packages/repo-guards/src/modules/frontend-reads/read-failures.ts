import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, GuardContext } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import { matchPattern, ownerOnly, reviewedAllowlist, type Hit } from '../../shapes/shapes.js';
import type { Reviewed } from '../../node/layout.js';
import { forEachNode, lineOfNode } from '../../support/ast.js';
import { identifierProblem, pathProblem, reviewedProblems, isList } from '../../support/facts.js';
import { escapeRegExp, isUnder } from '../../support/text.js';
import {
  APP_CODE,
  filesUnder,
  identifierListProblem,
  isHookName,
  pathListProblem,
  requiredFile,
} from './shared.js';

const RETRY_STATE_HELPERS = ['useReadRetryState', 'useReadRetryStates'] as const;
const RETRY_STATE_FIELD = 'isRetrying';
const HELD_ANSWER_FIELD = 'retrying';

export interface FailureSeat {
  component: string;
  retryProp: string;
  pendingProp: string;
}

function seatProblems(seat: FailureSeat | undefined): string[] {
  if (!seat || typeof seat !== 'object') return ['seat is missing'];
  const problems: string[] = [];
  identifierProblem(seat.component, 'seat.component', problems);
  identifierProblem(seat.retryProp, 'seat.retryProp', problems);
  identifierProblem(seat.pendingProp, 'seat.pendingProp', problems);
  return problems;
}

export interface ReadStateOwnerFacts {
  module: string;
  seatComponent: string;
  laterPageRetry: string;
}

export const readStateOwnerGuard: GenericGuardDefinition<ReadStateOwnerFacts> = {
  id: 'readStateOwner',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.module, 'module', problems);
    identifierProblem(facts?.seatComponent, 'seatComponent', problems);
    identifierProblem(facts?.laterPageRetry, 'laterPageRetry', problems);
    return problems;
  },
  build: (facts) => [
    ownerOnly({
      title: 'read failures render only through the read-state module',
      description:
        `Every read's pending, failed, and empty states render through ${facts.module}, so every failure offers Try again ` +
        `held through its retry. Nothing outside it renders <${facts.seatComponent}> or calls ${facts.laterPageRetry}(); ` +
        'render the read through the module instead.',
      scope: APP_CODE,
      match: matchPattern(
        new RegExp(
          `<${escapeRegExp(facts.seatComponent)}\\b|\\b${escapeRegExp(facts.laterPageRetry)}\\s*\\(`,
        ),
      ),
      owners: [facts.module],
      samples: {
        flags: [
          `return <${facts.seatComponent} thing="rows" />;`,
          `const retry = ${facts.laterPageRetry}(list);`,
        ],
        passes: [
          `// <${facts.seatComponent} /> named in prose only\nconst rows = 1;`,
          `import { ${facts.seatComponent} } from './seat';`,
        ],
      },
    }),
  ],
};

export interface ReadRetryStateFacts {
  seat: FailureSeat;
}

const FAILURE_FLAG = String.raw`[\w$.?]*\b(?:isError|error)\b`;
const FETCHING = String.raw`[\w$.?]*\bisFetching\b`;
const LIVE_FLAG_PAIRS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'failure flag && isFetching', re: new RegExp(`${FAILURE_FLAG}\\s*&&\\s*${FETCHING}`) },
  { name: 'isFetching && failure flag', re: new RegExp(`${FETCHING}\\s*&&\\s*${FAILURE_FLAG}`) },
];

const FETCHING_FLAG =
  /^(?:is(?:Re)?[Ff]etching|fetchingCount|useIsFetching|fetchStatus|sourceState)$/;

const fieldName = (name: ts.Node): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;

function retryStateExpressions(
  file: FileView,
  fields: readonly string[],
): Array<{ index: number; expression: ts.Expression }> {
  const sf = file.sourceFile;
  const wanted = new Set(fields);
  const found: Array<{ index: number; expression: ts.Expression }> = [];
  const add = (name: ts.Node, expression: ts.Expression | undefined) => {
    if (expression && wanted.has(fieldName(name) ?? ''))
      found.push({ index: name.getStart(sf), expression });
  };
  forEachNode(sf, (node) => {
    if (ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node))
      add(node.name, node.initializer);
    else if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer))
      add(node.name, node.initializer.expression);
    else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      add(ts.isPropertyAccessExpression(node.left) ? node.left.name : node.left, node.right);
    }
  });
  return found;
}

function readsFetchingFlag(
  expression: ts.Node,
  file: FileView,
  seen: Set<string> = new Set(),
): boolean {
  let reads = false;
  const bound: string[] = [];
  forEachNode(expression, (node) => {
    if (!ts.isIdentifier(node) || reads) return;
    if (FETCHING_FLAG.test(node.text)) reads = true;
    const parent = node.parent;
    const receiverOrCallee =
      (ts.isPropertyAccessExpression(parent) &&
        (parent.expression === node || parent.name === node)) ||
      (ts.isCallExpression(parent) && parent.expression === node);
    if (!receiverOrCallee) bound.push(node.text);
  });
  if (reads) return true;
  return bound.some((name) => {
    if (seen.has(name)) return false;
    seen.add(name);
    let declared: ts.Expression | undefined;
    let renamed = false;
    forEachNode(file.sourceFile, (node) => {
      if (
        ts.isBindingElement(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        node.propertyName &&
        FETCHING_FLAG.test(fieldName(node.propertyName) ?? '')
      ) {
        renamed = true;
      } else if (
        !declared &&
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        node.initializer
      ) {
        declared = node.initializer;
      }
    });
    if (renamed) return true;
    if (!declared) return false;
    const value = declared;
    const fromHelper =
      ts.isCallExpression(value) &&
      ts.isIdentifier(value.expression) &&
      (RETRY_STATE_HELPERS as readonly string[]).includes(value.expression.text);
    return !fromHelper && readsFetchingFlag(value, file, seen);
  });
}

export function liveFlagRetryStates(file: FileView, seat: FailureSeat): Hit[] {
  const code = file.code;
  const hits = new Map<number, Hit>();
  let offset = 0;
  for (const line of code.split('\n')) {
    for (const shape of LIVE_FLAG_PAIRS) {
      const m = shape.re.exec(line);
      if (m)
        hits.set(file.lineOf(offset + m.index), {
          index: offset + m.index,
          detail: `${shape.name}: ${line.trim().slice(0, 120)}`,
        });
    }
    offset += line.length + 1;
  }
  for (const { index, expression } of retryStateExpressions(file, [
    RETRY_STATE_FIELD,
    HELD_ANSWER_FIELD,
    seat.pendingProp,
  ])) {
    if (!readsFetchingFlag(expression, file)) continue;
    const line = file.lineOf(index);
    if (!hits.has(line))
      hits.set(line, {
        index,
        detail: `retry state from a fetching flag: ${expression.getText(file.sourceFile).replace(/\s+/g, ' ').slice(0, 120)}`,
      });
  }
  return [...hits.values()].sort((a, b) => a.index - b.index);
}

const isHookFunction = (node: ts.Node, sf: ts.SourceFile): boolean => {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name)
    return isHookName(node.name.text);
  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    ts.isVariableDeclaration(node.parent)
  )
    return isHookName(node.parent.name.getText(sf));
  return false;
};

export function failedAnswersWithoutRetrying(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  forEachNode(sf, (node) => {
    if (!ts.isObjectLiteralExpression(node)) return;
    const named = (name: string) =>
      node.properties.find(
        (p) =>
          (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
          p.name.getText(sf) === name,
      );
    const status = named('status');
    if (
      !status ||
      !ts.isPropertyAssignment(status) ||
      !ts.isStringLiteralLike(status.initializer) ||
      status.initializer.text !== 'failed'
    )
      return;
    if (!named('error') || named(HELD_ANSWER_FIELD) || node.properties.some(ts.isSpreadAssignment))
      return;
    let inHook = false;
    for (let p: ts.Node | undefined = node.parent; p && !inHook; p = p.parent)
      inHook = isHookFunction(p, sf);
    if (inHook)
      hits.push({
        index: node.getStart(sf),
        detail: `a failed answer with no ${HELD_ANSWER_FIELD}: ${node.getText(sf).replace(/\s+/g, ' ').slice(0, 120)}`,
      });
  });
  return hits;
}

export function seatRetriesWithoutPending(file: FileView, seat: FailureSeat): Hit[] {
  const hits: Hit[] = [];
  const element = new RegExp(`<${escapeRegExp(seat.component)}\\b[\\s\\S]*?\\/>`, 'g');
  for (const match of file.code.matchAll(element)) {
    const text = match[0];
    if (
      new RegExp(`\\b${escapeRegExp(seat.retryProp)}=`).test(text) &&
      !new RegExp(`\\b${escapeRegExp(seat.pendingProp)}=`).test(text) &&
      !/\{\s*\.\.\./.test(text)
    ) {
      hits.push({
        index: match.index ?? 0,
        detail: `<${seat.component} ${seat.retryProp}=…> without ${seat.pendingProp}`,
      });
    }
  }
  return hits;
}

export const readRetryStateGuard: GenericGuardDefinition<ReadRetryStateFacts> = {
  id: 'readRetryState',
  absentWhen: false,
  factProblems: (facts) => seatProblems(facts?.seat),
  build: (facts) => [
    {
      title: "a read's retry state comes from its one owner, never the live fetching flags",
      description:
        'TanStack Query puts a query that never succeeded back to pending and clears its error the moment a refetch starts, so a retry ' +
        'state built from isFetching / isRefetching / fetchStatus with isError or error reads false for the retry of a failed first read, ' +
        `and the failure turns into a loading state under the pressed retry. Hold the failure with query-core's ${RETRY_STATE_HELPERS.join(' / ')} ` +
        `(exposed from the read's hook) and pass its ${RETRY_STATE_FIELD}; a lookup hands out its held ${HELD_ANSWER_FIELD}, and a hook ` +
        `that answers with a status gives its failed answer the held ${HELD_ANSWER_FIELD} beside the error, never one built from a ` +
        `fetching flag; and every <${facts.seat.component}> given ${facts.seat.retryProp} also takes ${facts.seat.pendingProp}, so the ` +
        'pressed retry shows it is running.',
      run(context: GuardContext): Finding[] {
        const findings: Finding[] = [];
        for (const file of context.files(APP_CODE)) {
          const hits = [
            ...liveFlagRetryStates(file, facts.seat),
            ...seatRetriesWithoutPending(file, facts.seat),
            ...failedAnswersWithoutRetrying(file),
          ];
          for (const hit of hits) {
            findings.push({
              file: file.path,
              line: file.lineOf(hit.index),
              detail: hit.detail ?? '',
            });
          }
        }
        return findings;
      },
    },
  ],
};

export interface HookReadDefaultFacts {
  hooksTree: string;
  readCollapsers: readonly string[];
}

const FAILURE_FIELDS = new Set(['error', 'isError', 'status']);

function isEmptyAnswer(node: ts.Expression): boolean {
  return (
    (ts.isArrayLiteralExpression(node) && node.elements.length === 0) ||
    (ts.isObjectLiteralExpression(node) && node.properties.length === 0) ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isNumericLiteral(node) && node.text === '0') ||
    (ts.isStringLiteral(node) && node.text === '')
  );
}

function enclosingFunction(node: ts.Node): ts.Node | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current && !ts.isFunctionLike(current)) current = current.parent;
  return current;
}

function readsFailureOf(scope: ts.Node, receiver: string, sf: ts.SourceFile): boolean {
  let found = false;
  forEachNode(scope, (n) => {
    if (
      ts.isPropertyAccessExpression(n) &&
      FAILURE_FIELDS.has(n.name.text) &&
      n.expression.getText(sf) === receiver
    )
      found = true;
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(sf) === RETRY_STATE_HELPERS[0] &&
      n.arguments[0]?.getText(sf) === receiver
    )
      found = true;
  });
  return found;
}

function exportedHookBody(
  node: ts.Node,
  sf: ts.SourceFile,
): { name: string; body: ts.ConciseBody } | undefined {
  const isExported = (n: ts.Node) =>
    ts.canHaveModifiers(n) &&
    (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  if (
    ts.isFunctionDeclaration(node) &&
    node.name &&
    isHookName(node.name.text) &&
    isExported(node) &&
    node.body
  ) {
    return { name: node.name.text, body: node.body };
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    isHookName(node.name.text) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
    isExported(node.parent.parent)
  ) {
    return { name: node.name.getText(sf), body: node.initializer.body };
  }
  return undefined;
}

function returnedExpressions(body: ts.ConciseBody): ts.Expression[] {
  if (!ts.isBlock(body)) return [body];
  const out: ts.Expression[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(body, visit);
  return out;
}

function readsData(node: ts.Node): boolean {
  let found = false;
  forEachNode(node, (n) => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'data') found = true;
  });
  return found;
}

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.LessThanEqualsToken,
]);

function collapsesReadToBoolean(
  expr: ts.Expression,
  sf: ts.SourceFile,
  collapsers: ReadonlySet<string>,
): boolean {
  let e = expr;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isCallExpression(e) && collapsers.has(e.expression.getText(sf))) return true;
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken)
    return readsData(e);
  if (ts.isBinaryExpression(e) && COMPARISONS.has(e.operatorToken.kind)) return readsData(e);
  if (ts.isCallExpression(e) && e.expression.getText(sf) === 'Boolean') return readsData(e);
  return false;
}

export function hookReadDefaults(
  file: FileView,
  collapsers: readonly string[],
): Array<{ line: number; detail: string }> {
  const sf = file.sourceFile;
  const names = new Set(collapsers);
  const hits: Array<{ line: number; detail: string }> = [];
  forEachNode(sf, (node) => {
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken) &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'data' &&
      isEmptyAnswer(node.right)
    ) {
      const scope = enclosingFunction(node);
      if (!scope || !readsFailureOf(scope, node.left.expression.getText(sf), sf)) {
        hits.push({
          line: lineOfNode(file, node),
          detail: `a defaulted read with no failure beside it: ${node.getText(sf)}`,
        });
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectBindingPattern(node.name)
    ) {
      const init = node.initializer;
      if (ts.isCallExpression(init) && isHookName(init.expression.getText(sf))) {
        const keyOf = (el: ts.BindingElement) => (el.propertyName ?? el.name).getText(sf);
        const elements = node.name.elements;
        const defaultsData = elements.some(
          (el) => keyOf(el) === 'data' && el.initializer !== undefined,
        );
        const carriesFailure = elements.some(
          (el) => el.dotDotDotToken || FAILURE_FIELDS.has(keyOf(el)),
        );
        if (defaultsData && !carriesFailure)
          hits.push({
            line: lineOfNode(file, node),
            detail: `a defaulted read with no failure beside it: ${node.name.getText(sf)}`,
          });
      }
    }
    const hook = exportedHookBody(node, sf);
    if (hook) {
      for (const returned of returnedExpressions(hook.body)) {
        if (collapsesReadToBoolean(returned, sf, names))
          hits.push({
            line: lineOfNode(file, returned),
            detail: `${hook.name} returns a boolean from a read`,
          });
      }
    }
  });
  return hits;
}

export const hookReadDefaultGuard: GenericGuardDefinition<HookReadDefaultFacts> = {
  id: 'hookReadDefault',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.hooksTree, 'hooksTree', problems);
    identifierListProblem(facts?.readCollapsers, 'readCollapsers', problems, { nonEmpty: false });
    return problems;
  },
  build: (facts) => [
    {
      title: 'a hook never returns a default its consumers cannot tell from data',
      description:
        `In ${facts.hooksTree}, a read's data defaulted to an empty answer (q.data ?? [], const { data = [] } = useQ()) is allowed only ` +
        `where the same function also carries that read's failure (error / isError / status, or the read handed to ${RETRY_STATE_HELPERS[0]}), ` +
        'and no exported hook collapses a read into a bare boolean, where an unknown read would read as "no". Return the read state ' +
        '(pending / failed / answered) or carry the failure beside the defaulted data.',
      run(context) {
        const { files, findings } = filesUnder(context, [facts.hooksTree]);
        for (const file of files)
          for (const hit of hookReadDefaults(file, facts.readCollapsers))
            findings.push({ file: file.path, ...hit });
        return findings;
      },
    },
  ],
};

export interface DefaultedReadBindingFacts {
  surfaceTrees: readonly string[];
  heldFailureFields: readonly string[];
  allowlist: ReadonlyArray<Reviewed & { gate: ReadGate }>;
}

export interface ReadGate {
  file: string;
  code: string;
}

const squashed = (text: string) => text.replace(/\s+/g, ' ').trim();

function gateProblems(allowlist: unknown): string[] {
  if (!isList(allowlist)) return [];
  const problems: string[] = [];
  for (const entry of allowlist as Array<{ path?: string; gate?: Partial<ReadGate> }>) {
    const what = `allowlist entry ${String(entry?.path)}`;
    if (!entry?.gate || typeof entry.gate !== 'object')
      problems.push(
        `${what} names no gate (the file and the code that hold its surface back until the read answered)`,
      );
    else {
      pathProblem(entry.gate.file, `${what}'s gate file`, problems);
      if (typeof entry.gate.code !== 'string' || !entry.gate.code.trim())
        problems.push(`${what}'s gate names no code`);
    }
  }
  return problems;
}

function missingGates(
  context: GuardContext,
  allowlist: DefaultedReadBindingFacts['allowlist'],
): Finding[] {
  const findings: Finding[] = [];
  for (const { path, gate } of allowlist) {
    if (!context.reader.exists(gate.file))
      findings.push({
        file: gate.file,
        detail: `the gate ${path} relies on is gone: the file no longer exists`,
      });
    else if (!squashed(context.file(gate.file).code).includes(squashed(gate.code))) {
      findings.push({
        file: gate.file,
        detail: `the gate ${path} relies on is gone: no longer holds ${squashed(gate.code)}`,
      });
    }
  }
  return findings;
}

export function unguardedDataDefaults(file: FileView, heldFailureFields: readonly string[]): Hit[] {
  const sf = file.sourceFile;
  const failureBindings = new Set([...FAILURE_FIELDS, ...heldFailureFields]);
  const hits: Hit[] = [];
  forEachNode(sf, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !node.initializer ||
      !ts.isObjectBindingPattern(node.name)
    )
      return;
    let init: ts.Expression = node.initializer;
    if (ts.isAwaitExpression(init)) init = init.expression;
    if (!ts.isCallExpression(init)) return;
    const callee = init.expression.getText(sf);
    if (!isHookName(callee)) return;
    const elements = node.name.elements;
    if (elements.some((el) => el.dotDotDotToken)) return;
    const keyOf = (el: ts.BindingElement) => (el.propertyName ?? el.name).getText(sf);
    if (!elements.some((el) => keyOf(el) === 'data' && el.initializer !== undefined)) return;
    if (elements.some((el) => failureBindings.has(keyOf(el)))) return;
    hits.push({
      index: node.getStart(sf),
      detail: `${callee}() defaults data with no failure bound`,
    });
  });
  return hits;
}

export const defaultedReadBindingGuard: GenericGuardDefinition<DefaultedReadBindingFacts> = {
  id: 'defaultedReadBinding',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathListProblem(facts?.surfaceTrees, 'surfaceTrees', problems);
    identifierListProblem(facts?.heldFailureFields, 'heldFailureFields', problems, {
      nonEmpty: false,
    });
    reviewedProblems(facts?.allowlist, 'allowlist', problems);
    return [...problems, ...gateProblems(facts?.allowlist)];
  },
  build: (facts) => {
    const held = facts.heldFailureFields.length ? ` / ${facts.heldFailureFields.join(' / ')}` : '';
    const guard = reviewedAllowlist({
      title: 'a render surface that defaults a read binds its failure',
      description:
        `A render surface (${facts.surfaceTrees.join(', ')}) that defaults a read's data (const { data: rows = [] } = useRows()) binds ` +
        `that same read's failure (error / isError / status${held}) in the same destructure, and renders the pending and failed states ` +
        'before the default is used; otherwise a failed read renders as an empty list, a zero, or a negative answer that decides a control. ' +
        'A reviewed default names the gate that holds its surface back until the read answered, and that gate must still be there.',
      scope: APP_CODE,
      match: (file) =>
        facts.surfaceTrees.some((tree) => isUnder(file.path, tree))
          ? unguardedDataDefaults(file, facts.heldFailureFields)
          : [],
      allowlist: facts.allowlist,
      samples: {
        flags: [
          {
            path: `${facts.surfaceTrees[0]}/sample.tsx`,
            text: 'const { data: rows = [] } = useRows(id);',
          },
        ],
        passes: [
          {
            path: `${facts.surfaceTrees[0]}/sample.tsx`,
            text: 'const { data: rows = [], isError } = useRows(id);',
          },
        ],
      },
    });
    return [
      {
        ...guard,
        run: async (context) => [
          ...(await guard.run(context)),
          ...missingGates(context, facts.allowlist),
        ],
      },
    ];
  },
};

export interface LaterPageFailureFacts {
  hooksTree: string;
  readStateModule: string;
  listRoutes: ReadonlyArray<{ component: string; prop?: string }>;
  handOffProp: string;
}

const PAGES = /\b(?:fetchNextPage|hasNextPage)\b/;

function routedPattern(routes: LaterPageFailureFacts['listRoutes']): RegExp {
  return new RegExp(
    routes
      .map(({ component, prop }) =>
        prop
          ? `<${escapeRegExp(component)}\\s[^>]*?\\b${escapeRegExp(prop)}=`
          : `<${escapeRegExp(component)}\\b`,
      )
      .join('|'),
  );
}

export function unroutedPagingSurfaces(
  files: readonly FileView[],
  facts: LaterPageFailureFacts,
): FileView[] {
  const routed = routedPattern(facts.listRoutes);
  const routing = new Set(
    files
      .filter((f) => routed.test(f.code))
      .flatMap((f) => [...f.code.matchAll(/export function ([A-Z]\w*)/g)].map((m) => m[1])),
  );
  const handOff = new RegExp(`<([A-Z]\\w*)\\s[^>]*?\\b${escapeRegExp(facts.handOffProp)}=\\{`, 'g');
  return files.filter((f) => {
    if (!PAGES.test(f.code) || routed.test(f.code)) return false;
    return ![...f.code.matchAll(handOff)].some((m) => routing.has(m[1]));
  });
}

export const laterPageFailureGuard: GenericGuardDefinition<LaterPageFailureFacts> = {
  id: 'laterPageFailure',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.hooksTree, 'hooksTree', problems);
    pathProblem(facts?.readStateModule, 'readStateModule', problems);
    identifierProblem(facts?.handOffProp, 'handOffProp', problems);
    if (!isList(facts?.listRoutes) || !facts.listRoutes.length)
      problems.push('listRoutes names no component');
    else
      facts.listRoutes.forEach((r, i) => {
        identifierProblem(r?.component, `listRoutes[${i}].component`, problems);
        if (r?.prop !== undefined) identifierProblem(r.prop, `listRoutes[${i}].prop`, problems);
      });
    return problems;
  },
  build: (facts) => [
    {
      title: "an infinite list's later-page failure routes through the read-state module",
      description:
        `Every surface that pages an infinite list (fetchNextPage / hasNextPage) renders it through ` +
        `${facts.listRoutes.map((r) => `<${r.component}${r.prop ? ` ${r.prop}=…` : ''}>`).join(' or ')} from ${facts.readStateModule}, ` +
        `or hands it (${facts.handOffProp}=…) to a component whose own file does, so a failed load-more retries that page instead of ` +
        'refetching the whole list.',
      run(context) {
        const { findings, file: module } = requiredFile(
          context,
          facts.readStateModule,
          'the read-state module',
        );
        if (!module) return findings;
        const surfaces = context
          .files(APP_CODE)
          .filter((f) => !isUnder(f.path, facts.hooksTree) && f.path !== facts.readStateModule);
        for (const file of unroutedPagingSurfaces(surfaces, facts)) {
          findings.push({
            file: file.path,
            detail:
              'pages an infinite list without routing its later-page failure through the read-state module',
          });
        }
        return findings;
      },
    },
  ],
};

export interface ReadFailureCopyFacts {
  owner: string;
  allowlist: readonly Reviewed[];
}

export const READ_FAILURE_SENTENCE =
  /(?:could not|couldn['’]?t|failed to|unable to)\s+(?:load|search|fetch|read|retrieve|check|find)\b|error\s+(?:loading|searching|fetching|reading)\b/i;

export const readFailureCopyGuard: GenericGuardDefinition<ReadFailureCopyFacts> = {
  id: 'readFailureCopy',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.owner, 'owner', problems);
    reviewedProblems(facts?.allowlist, 'allowlist', problems);
    if (isList(facts?.allowlist) && facts.allowlist.some((e) => e?.path === facts.owner))
      problems.push('the owner is listed in the allowlist');
    return problems;
  },
  build: (facts) => [
    reviewedAllowlist({
      title: "a read failure's copy comes from its one owner",
      description:
        `Every read-failure sentence a person sees is built by ${facts.owner} from the short noun the surface names; no other file ` +
        'hand-writes one ("could not load", "failed to load", "error loading", or the same around another read verb, in any casing). ' +
        'Render the owner (with surface-specific guidance as its hint), or — for text never shown to a person — add a reviewed entry with its why.',
      scope: APP_CODE,
      match: matchPattern(READ_FAILURE_SENTENCE),
      allowlist: [
        { path: facts.owner, why: 'the one owner of read-failure copy' },
        ...facts.allowlist,
      ],
      samples: {
        flags: [
          '<p>Could not load the rows.</p>',
          '<AlertTitle>Error Loading Rows</AlertTitle>',
          'const m = "Couldn\'t fetch the list.";',
        ],
        passes: [
          'hint="a list that could not be read is not an empty list."',
          '<LoadingState label="Loading rows" />',
        ],
      },
    }),
  ],
};

export const READ_FAILURE_GUARDS = [
  readStateOwnerGuard,
  readRetryStateGuard,
  hookReadDefaultGuard,
  defaultedReadBindingGuard,
  laterPageFailureGuard,
  readFailureCopyGuard,
] as const;
