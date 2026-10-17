// How a read's failure reaches the person: through the app's one read-state module, from a retry
// state held through its retry, from hooks and surfaces that never pass a failed read off as data,
// and with copy from the one failure-copy owner.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding, GuardContext } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import { matchPattern, ownerOnly, reviewedAllowlist, type Hit } from '../../shapes/shapes.js';
import {
  APP_CODE,
  alternation,
  escapeRegExp,
  filesUnder,
  identifierListProblems,
  identifierProblems,
  isHookName,
  isUnder,
  lineOfNode,
  pathListProblems,
  pathProblems,
  requiredFile,
  reviewedFileProblems,
  walk,
  type ReviewedFile,
} from './shared.js';

/** query-core's held retry state: the hooks that hold a read's failure through its retry, and its field. */
const RETRY_STATE_HELPERS = ['useReadRetryState', 'useReadRetryStates'] as const;
const RETRY_STATE_FIELD = 'isRetrying';

/** The app's one failure seat: the component, the prop it takes a retry on, and the prop that shows it running. */
export interface FailureSeat {
  component: string;
  retryProp: string;
  pendingProp: string;
}

function seatProblems(seat: FailureSeat | undefined): string[] {
  if (!seat || typeof seat !== 'object') return ['seat is missing'];
  return [
    ...identifierProblems(seat.component, 'seat.component'),
    ...identifierProblems(seat.retryProp, 'seat.retryProp'),
    ...identifierProblems(seat.pendingProp, 'seat.pendingProp'),
  ];
}

// =============================================================================================
// Read failures render only through the read-state module.
// =============================================================================================

export interface ReadStateOwnerFacts {
  /** The read-state module: the one file that renders a read's failure seat. */
  module: string;
  /** The failure seat component the module renders. */
  seatComponent: string;
  /** The module's function that routes an infinite list's later-page failure to its retry. */
  laterPageRetry: string;
}

export const readStateOwnerGuard: GenericGuardDefinition<ReadStateOwnerFacts> = {
  id: 'readStateOwner',
  absentWhen: false,
  factProblems: (facts) => [
    ...pathProblems(facts?.module, 'module'),
    ...identifierProblems(facts?.seatComponent, 'seatComponent'),
    ...identifierProblems(facts?.laterPageRetry, 'laterPageRetry'),
  ],
  build: (facts) => [
    ownerOnly({
      title: 'read failures render only through the read-state module',
      description:
        `Every read's pending, failed, and empty states render through ${facts.module}, so every failure offers Try again ` +
        `held through its retry. Nothing outside it renders <${facts.seatComponent}> or calls ${facts.laterPageRetry}(); ` +
        'render the read through the module instead.',
      scope: APP_CODE,
      match: matchPattern(new RegExp(`<${escapeRegExp(facts.seatComponent)}\\b|\\b${escapeRegExp(facts.laterPageRetry)}\\s*\\(`)),
      owners: [facts.module],
      samples: {
        flags: [`return <${facts.seatComponent} thing="rows" />;`, `const retry = ${facts.laterPageRetry}(list);`],
        passes: [`// <${facts.seatComponent} /> named in prose only\nconst rows = 1;`, `import { ${facts.seatComponent} } from './seat';`],
      },
    }),
  ],
};

// =============================================================================================
// A read's retry state comes from its one owner, never the live fetching flags.
// =============================================================================================

export interface ReadRetryStateFacts {
  seat: FailureSeat;
}

/** A failure flag and the fetch flag in one boolean expression, either order. */
const FAILURE_FLAG = String.raw`[\w$.?]*\b(?:isError|error)\b`;
const FETCHING = String.raw`[\w$.?]*\bisFetching\b`;
const LIVE_FLAG_PAIRS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'failure flag && isFetching', re: new RegExp(`${FAILURE_FLAG}\\s*&&\\s*${FETCHING}`) },
  { name: 'isFetching && failure flag', re: new RegExp(`${FETCHING}\\s*&&\\s*${FAILURE_FLAG}`) },
];

const FETCHING_FLAG = /\bis(?:Re)?[Ff]etching\b|\bfetchingCount\b|\buseIsFetching\b|\bfetchStatus\b|\bsourceState\b/;

/** Every retry state a source builds — a field, a prop, or a binding — with the expression it is built from. */
function retryStateExpressions(code: string, fields: readonly string[]): Array<{ index: number; expression: string }> {
  const start = new RegExp(`\\b(?:${alternation(fields)})\\s*(=\\{|:|=(?!=))`, 'g');
  const found: Array<{ index: number; expression: string }> = [];
  for (let match = start.exec(code); match; match = start.exec(code)) {
    const jsx = match[1] === '={';
    const begin = match.index + match[0].length;
    let depth = jsx ? 1 : 0;
    let i = begin;
    for (; i < code.length; i += 1) {
      const c = code[i];
      if (c === '(' || c === '[' || c === '{') depth += 1;
      else if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) break;
        depth -= 1;
        if (jsx && depth === 0) break;
      } else if (depth === 0 && (c === ',' || c === ';' || (c === '\n' && code.slice(begin, i).trim() !== ''))) break;
    }
    found.push({ index: match.index, expression: code.slice(begin, i).trim() });
  }
  return found;
}

/** Whether an expression reads a fetching flag directly, or through a binding the same source declares from one. */
function readsFetchingFlag(expression: string, code: string): boolean {
  if (FETCHING_FLAG.test(expression)) return true;
  const bare = [...expression.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\b(?!\s*[.(])/g)].map((m) => m[1]);
  return bare.some((name) => {
    const declared = new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*([^;\\n]+)`).exec(code);
    if (!declared) return false;
    const value = declared[1].trim();
    return !RETRY_STATE_HELPERS.some((helper) => value.startsWith(`${helper}(`)) && FETCHING_FLAG.test(value);
  });
}

/** Each retry state built from TanStack Query's live flags in one file. */
export function liveFlagRetryStates(file: FileView, seat: FailureSeat): Hit[] {
  const code = file.code;
  const hits = new Map<number, Hit>();
  let offset = 0;
  for (const line of code.split('\n')) {
    for (const shape of LIVE_FLAG_PAIRS) {
      const m = shape.re.exec(line);
      if (m) hits.set(file.lineOf(offset + m.index), { index: offset + m.index, detail: `${shape.name}: ${line.trim().slice(0, 120)}` });
    }
    offset += line.length + 1;
  }
  for (const { index, expression } of retryStateExpressions(code, [RETRY_STATE_FIELD, seat.pendingProp])) {
    if (!readsFetchingFlag(expression, code)) continue;
    const line = file.lineOf(index);
    if (!hits.has(line)) hits.set(line, { index, detail: `retry state from a fetching flag: ${expression.replace(/\s+/g, ' ').slice(0, 120)}` });
  }
  return [...hits.values()].sort((a, b) => a.index - b.index);
}

/** Each seat given a retry but not the prop that shows the retry running. A spread supplies both. */
export function seatRetriesWithoutPending(file: FileView, seat: FailureSeat): Hit[] {
  const hits: Hit[] = [];
  const element = new RegExp(`<${escapeRegExp(seat.component)}\\b[\\s\\S]*?\\/>`, 'g');
  for (const match of file.code.matchAll(element)) {
    const text = match[0];
    if (new RegExp(`\\b${escapeRegExp(seat.retryProp)}=`).test(text) && !new RegExp(`\\b${escapeRegExp(seat.pendingProp)}=`).test(text) && !/\{\s*\.\.\./.test(text)) {
      hits.push({ index: match.index ?? 0, detail: `<${seat.component} ${seat.retryProp}=…> without ${seat.pendingProp}` });
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
        "TanStack Query puts a query that never succeeded back to pending and clears its error the moment a refetch starts, so a retry " +
        "state built from isFetching / isRefetching / fetchStatus with isError or error reads false for the retry of a failed first read, " +
        `and the failure turns into a loading state under the pressed retry. Hold the failure with query-core's ${RETRY_STATE_HELPERS.join(' / ')} ` +
        `(exposed from the read's hook) and pass its ${RETRY_STATE_FIELD}; and every <${facts.seat.component}> given ${facts.seat.retryProp} ` +
        `also takes ${facts.seat.pendingProp}, so the pressed retry shows it is running.`,
      run(context: GuardContext): Finding[] {
        const findings: Finding[] = [];
        for (const file of context.files(APP_CODE)) {
          for (const hit of [...liveFlagRetryStates(file, facts.seat), ...seatRetriesWithoutPending(file, facts.seat)]) {
            findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail ?? '' });
          }
        }
        return findings;
      },
    },
  ],
};

// =============================================================================================
// A hook never returns a default its consumers cannot tell from data.
// =============================================================================================

export interface HookReadDefaultFacts {
  /** The app's hooks tree. */
  hooksTree: string;
  /** App functions that collapse a read state into a yes/no (an empty list when the app has none). */
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

/** Whether `scope` reads `<receiver>.error` / `.isError` / `.status`, or hands `receiver` to the held retry state. */
function readsFailureOf(scope: ts.Node, receiver: string, sf: ts.SourceFile): boolean {
  let found = false;
  walk(scope, (n) => {
    if (ts.isPropertyAccessExpression(n) && FAILURE_FIELDS.has(n.name.text) && n.expression.getText(sf) === receiver) found = true;
    if (ts.isCallExpression(n) && n.expression.getText(sf) === RETRY_STATE_HELPERS[0] && n.arguments[0]?.getText(sf) === receiver) found = true;
  });
  return found;
}

function exportedHookBody(node: ts.Node, sf: ts.SourceFile): { name: string; body: ts.ConciseBody } | undefined {
  const isExported = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  if (ts.isFunctionDeclaration(node) && node.name && isHookName(node.name.text) && isExported(node) && node.body) {
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
  walk(node, (n) => {
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

function collapsesReadToBoolean(expr: ts.Expression, sf: ts.SourceFile, collapsers: ReadonlySet<string>): boolean {
  let e = expr;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isCallExpression(e) && collapsers.has(e.expression.getText(sf))) return true;
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) return readsData(e);
  if (ts.isBinaryExpression(e) && COMPARISONS.has(e.operatorToken.kind)) return readsData(e);
  if (ts.isCallExpression(e) && e.expression.getText(sf) === 'Boolean') return readsData(e);
  return false;
}

/** Every read default in a hook file whose failure the same function does not carry, and every hook collapsing a read to a boolean. */
export function hookReadDefaults(file: FileView, collapsers: readonly string[]): Array<{ line: number; detail: string }> {
  const sf = file.sourceFile;
  const names = new Set(collapsers);
  const hits: Array<{ line: number; detail: string }> = [];
  walk(sf, (node) => {
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken) &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'data' &&
      isEmptyAnswer(node.right)
    ) {
      const scope = enclosingFunction(node);
      if (!scope || !readsFailureOf(scope, node.left.expression.getText(sf), sf)) {
        hits.push({ line: lineOfNode(sf, node), detail: `a defaulted read with no failure beside it: ${node.getText(sf)}` });
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectBindingPattern(node.name)) {
      const init = node.initializer;
      if (ts.isCallExpression(init) && isHookName(init.expression.getText(sf))) {
        const keyOf = (el: ts.BindingElement) => (el.propertyName ?? el.name).getText(sf);
        const elements = node.name.elements;
        const defaultsData = elements.some((el) => keyOf(el) === 'data' && el.initializer !== undefined);
        const carriesFailure = elements.some((el) => el.dotDotDotToken || FAILURE_FIELDS.has(keyOf(el)));
        if (defaultsData && !carriesFailure) hits.push({ line: lineOfNode(sf, node), detail: `a defaulted read with no failure beside it: ${node.name.getText(sf)}` });
      }
    }
    const hook = exportedHookBody(node, sf);
    if (hook) {
      for (const returned of returnedExpressions(hook.body)) {
        if (collapsesReadToBoolean(returned, sf, names)) hits.push({ line: lineOfNode(sf, returned), detail: `${hook.name} returns a boolean from a read` });
      }
    }
  });
  return hits;
}

export const hookReadDefaultGuard: GenericGuardDefinition<HookReadDefaultFacts> = {
  id: 'hookReadDefault',
  absentWhen: false,
  factProblems: (facts) => [
    ...pathProblems(facts?.hooksTree, 'hooksTree'),
    ...identifierListProblems(facts?.readCollapsers, 'readCollapsers', { allowEmpty: true }),
  ],
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
        for (const file of files) for (const hit of hookReadDefaults(file, facts.readCollapsers)) findings.push({ file: file.path, ...hit });
        return findings;
      },
    },
  ],
};

// =============================================================================================
// A render surface that defaults a read binds its failure.
// =============================================================================================

export interface DefaultedReadBindingFacts {
  /** The trees that render (components, pages). */
  surfaceTrees: readonly string[];
  /** Fields beyond error / isError / status that carry a read's failure (a held retry state); [] for none. */
  heldFailureFields: readonly string[];
  /** Files whose defaulted read is known to have answered before it renders, each with its why. */
  allowlist: readonly ReviewedFile[];
}

/** Destructures of a hook call that default `data` but bind no failure field. */
export function unguardedDataDefaults(file: FileView, heldFailureFields: readonly string[]): Hit[] {
  const sf = file.sourceFile;
  const failureBindings = new Set([...FAILURE_FIELDS, ...heldFailureFields]);
  const hits: Hit[] = [];
  walk(sf, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isObjectBindingPattern(node.name)) return;
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
    hits.push({ index: node.getStart(sf), detail: `${callee}() defaults data with no failure bound` });
  });
  return hits;
}

export const defaultedReadBindingGuard: GenericGuardDefinition<DefaultedReadBindingFacts> = {
  id: 'defaultedReadBinding',
  absentWhen: false,
  factProblems: (facts) => [
    ...pathListProblems(facts?.surfaceTrees, 'surfaceTrees'),
    ...identifierListProblems(facts?.heldFailureFields, 'heldFailureFields', { allowEmpty: true }),
    ...reviewedFileProblems(facts?.allowlist, 'allowlist'),
  ],
  build: (facts) => {
    const held = facts.heldFailureFields.length ? ` / ${facts.heldFailureFields.join(' / ')}` : '';
    return [
      reviewedAllowlist({
        title: 'a render surface that defaults a read binds its failure',
        description:
          `A render surface (${facts.surfaceTrees.join(', ')}) that defaults a read's data (const { data: rows = [] } = useRows()) binds ` +
          `that same read's failure (error / isError / status${held}) in the same destructure, and renders the pending and failed states ` +
          'before the default is used; otherwise a failed read renders as an empty list, a zero, or a negative answer that decides a control.',
        scope: APP_CODE,
        match: (file) => (facts.surfaceTrees.some((tree) => isUnder(file.path, tree)) ? unguardedDataDefaults(file, facts.heldFailureFields) : []),
        allowlist: facts.allowlist,
        samples: {
          flags: [{ path: `${facts.surfaceTrees[0]}/sample.tsx`, text: 'const { data: rows = [] } = useRows(id);' }],
          passes: [{ path: `${facts.surfaceTrees[0]}/sample.tsx`, text: 'const { data: rows = [], isError } = useRows(id);' }],
        },
      }),
    ];
  },
};

// =============================================================================================
// An infinite list's later-page failure goes through the read-state module.
// =============================================================================================

export interface LaterPageFailureFacts {
  /** The app's hooks tree (the hooks that page are not render surfaces). */
  hooksTree: string;
  /** The read-state module. */
  readStateModule: string;
  /** The module's components that place a list's later-page failure, and the prop a list is handed on (omitted: any use routes). */
  listRoutes: ReadonlyArray<{ component: string; prop?: string }>;
  /** The prop a paging surface hands its list to another component on. */
  handOffProp: string;
}

const PAGES = /\b(?:fetchNextPage|hasNextPage)\b/;

function routedPattern(routes: LaterPageFailureFacts['listRoutes']): RegExp {
  return new RegExp(
    routes.map(({ component, prop }) => (prop ? `<${escapeRegExp(component)}\\s[^>]*?\\b${escapeRegExp(prop)}=` : `<${escapeRegExp(component)}\\b`)).join('|'),
  );
}

/** The paging surfaces that never route their list's later-page failure through the module. */
export function unroutedPagingSurfaces(files: readonly FileView[], facts: LaterPageFailureFacts): FileView[] {
  const routed = routedPattern(facts.listRoutes);
  const routing = new Set(
    files.filter((f) => routed.test(f.code)).flatMap((f) => [...f.code.matchAll(/export function ([A-Z]\w*)/g)].map((m) => m[1])),
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
    const problems = [
      ...pathProblems(facts?.hooksTree, 'hooksTree'),
      ...pathProblems(facts?.readStateModule, 'readStateModule'),
      ...identifierProblems(facts?.handOffProp, 'handOffProp'),
    ];
    if (!Array.isArray(facts?.listRoutes) || !facts.listRoutes.length) problems.push('listRoutes names no component');
    else
      facts.listRoutes.forEach((r, i) => {
        problems.push(...identifierProblems(r?.component, `listRoutes[${i}].component`));
        if (r?.prop !== undefined) problems.push(...identifierProblems(r.prop, `listRoutes[${i}].prop`));
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
        const { findings, file: module } = requiredFile(context, facts.readStateModule, 'the read-state module');
        if (!module) return findings;
        const surfaces = context.files(APP_CODE).filter((f) => !isUnder(f.path, facts.hooksTree) && f.path !== facts.readStateModule);
        for (const file of unroutedPagingSurfaces(surfaces, facts)) {
          findings.push({ file: file.path, detail: "pages an infinite list without routing its later-page failure through the read-state module" });
        }
        return findings;
      },
    },
  ],
};

// =============================================================================================
// A read failure's copy has one owner.
// =============================================================================================

export interface ReadFailureCopyFacts {
  /** The one component that builds every read-failure sentence. */
  owner: string;
  /** Files that carry such a sentence for a reason other than copy shown to a person, each with its why. */
  allowlist: readonly ReviewedFile[];
}

/** A hand-written read-failure sentence, in any casing, around any read verb. */
export const READ_FAILURE_SENTENCE =
  /(?:could not|couldn['’]?t|failed to|unable to)\s+(?:load|search|fetch|read|retrieve|check|find)\b|error\s+(?:loading|searching|fetching|reading)\b/i;

export const readFailureCopyGuard: GenericGuardDefinition<ReadFailureCopyFacts> = {
  id: 'readFailureCopy',
  absentWhen: false,
  factProblems(facts) {
    const problems = [...pathProblems(facts?.owner, 'owner'), ...reviewedFileProblems(facts?.allowlist, 'allowlist')];
    if (Array.isArray(facts?.allowlist) && facts.allowlist.some((e) => e?.path === facts.owner)) problems.push('the owner is listed in the allowlist');
    return problems;
  },
  build: (facts) => [
    reviewedAllowlist({
      title: "a read failure's copy comes from its one owner",
      description:
        `Every read-failure sentence a person sees is built by ${facts.owner} from the short noun the surface names; no other file ` +
        "hand-writes one (\"could not load\", \"failed to load\", \"error loading\", or the same around another read verb, in any casing). " +
        'Render the owner (with surface-specific guidance as its hint), or — for text never shown to a person — add a reviewed entry with its why.',
      scope: APP_CODE,
      match: matchPattern(READ_FAILURE_SENTENCE),
      allowlist: [{ path: facts.owner, why: 'the one owner of read-failure copy' }, ...facts.allowlist],
      samples: {
        flags: ['<p>Could not load the rows.</p>', '<AlertTitle>Error Loading Rows</AlertTitle>', "const m = \"Couldn't fetch the list.\";"],
        passes: ['hint="a list that could not be read is not an empty list."', '<LoadingState label="Loading rows" />'],
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
