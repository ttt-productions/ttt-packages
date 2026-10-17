// The failure-handling guards over Cloud Functions code: no read or write whose failure is
// swallowed, every post-commit effect captures its failure, and a scheduled handler isolates its
// passes so one pass's throw never skips the next.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { calleeName, forEachNode, lineOfNode } from '../../support/ast.js';
import { namesProblem, reviewedProblems, textProblem } from '../../support/facts.js';
import { calleePath } from './shared.js';

const FUNCTIONS_CODE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };

/** Whether a subtree throws, rejects, captures, or calls one of the given surfacing calls. */
function surfaces(node: ts.Node, surfacingCalls: ReadonlySet<string>, { awaitCounts }: { awaitCounts: boolean }): boolean {
  let found = false;
  forEachNode(node, (n) => {
    if (found) return;
    if (ts.isThrowStatement(n) || (awaitCounts && ts.isAwaitExpression(n))) found = true;
    else if (ts.isCallExpression(n)) {
      const name = calleeName(n);
      if (calleePath(n) === 'Promise.reject' || (name && surfacingCalls.has(name))) found = true;
    }
  });
  return found;
}

// ---------------------------------------------------------------------------------------------
// No swallowed read or write.

export interface SwallowedReadWriteFacts {
  /** The monitoring capture calls (`captureException`, `captureMessage`). */
  captureCalls: readonly string[];
  /** App calls that surface a failure themselves (a callable's one exit that rethrows it). */
  failureExits: readonly string[];
  /**
   * Caught promises that are never a database read or write, each bound to the file it is caught in
   * and matched against the caught expression there.
   */
  notReadOrWrite: ReadonlyArray<{ file: string; pattern: RegExp; why: string }>;
  /** `.catch` sites reviewed by file and the start of the caught expression. */
  catchSites: ReadonlyArray<{ file: string; receiver: string; why: string }>;
  /** `try`/`catch` sites reviewed by file and enclosing function. */
  tryCatchSites: ReadonlyArray<{ file: string; function: string; why: string }>;
}

/** A call inside a `try` block that reads or writes the database. */
const READ_WRITE_METHODS = new Set(['get', 'set', 'update', 'delete', 'create', 'commit', 'getAll', 'add']);

function readsOrWrites(block: ts.Node): boolean {
  let found = false;
  forEachNode(block, (n) => {
    if (found || !ts.isCallExpression(n)) return;
    if (ts.isPropertyAccessExpression(n.expression) && READ_WRITE_METHODS.has(n.expression.name.text)) found = true;
    else if (calleeName(n) === 'runTransaction') found = true;
  });
  return found;
}

/** The name the enclosing function is known by: a declaration, a method, or the variable it is bound to. */
function enclosingName(node: ts.Node, sf: ts.SourceFile): string {
  for (let p = node.parent; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText(sf);
    if (ts.isVariableDeclaration(p)) return p.name.getText(sf);
  }
  return '(module)';
}

/** Every swallowing `.catch` (with its caught expression) and swallowing `try`/`catch` (with its function). */
export function swallowedFailures(file: FileView, facts: Pick<SwallowedReadWriteFacts, 'captureCalls' | 'failureExits'>) {
  const sf = file.sourceFile;
  const surfacing = new Set([...facts.captureCalls, ...facts.failureExits]);
  const catches: Array<{ node: ts.Node; receiver: string }> = [];
  const tries: Array<{ node: ts.Node; fn: string }> = [];
  forEachNode(sf, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch' &&
      node.arguments.length > 0 &&
      !surfaces(node.arguments[0]!, surfacing, { awaitCounts: false })
    ) {
      catches.push({ node, receiver: node.expression.expression.getText(sf).replace(/\s+/g, ' ').trim() });
    }
    if (ts.isTryStatement(node) && node.catchClause && readsOrWrites(node.tryBlock) && !surfaces(node.catchClause.block, surfacing, { awaitCounts: true })) {
      tries.push({ node, fn: enclosingName(node, sf) });
    }
  });
  return { catches, tries };
}

export const swallowedReadWriteGuard: GenericGuardDefinition<SwallowedReadWriteFacts> = {
  id: 'swallowedReadWrite',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.captureCalls, 'captureCalls', problems);
    namesProblem(facts?.failureExits, 'failureExits', problems, { nonEmpty: false });
    reviewedProblems(facts?.notReadOrWrite, 'notReadOrWrite', problems, {
      key: 'file',
      id: (e) => (e.pattern instanceof RegExp ? `${e.file} ${String(e.pattern)}` : undefined),
      idNames: 'pattern',
    });
    reviewedProblems(facts?.catchSites, 'catchSites', problems, {
      key: 'file',
      id: (e) => (typeof e.receiver === 'string' && e.receiver ? `${e.file} ${e.receiver}` : undefined),
      idNames: 'receiver',
    });
    reviewedProblems(facts?.tryCatchSites, 'tryCatchSites', problems, {
      key: 'file',
      id: (e) => (typeof e.function === 'string' && e.function ? `${e.file} ${e.function}` : undefined),
      idNames: 'function',
    });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no backend read or write has its failure swallowed',
        description:
          'A swallowed read turns a skipped record into "nothing there", and a swallowed write turns a lost state change ' +
          'into success. Every `.catch(handler)` rethrows, rejects, or captures; every `try`/`catch` around a read or write ' +
          'rethrows, captures, or records the failure through an awaited call (a terminal row, a retry ledger). A handler ' +
          'that falls back to a value still captures. A caught promise that is never a read or write, and a site that keeps ' +
          'its failure on purpose, is a reviewed entry bound to its file with its why; an entry that matches nothing in its file is stale.',
        run(context) {
          const findings: Finding[] = [];
          const usedShapes = new Set<(typeof facts.notReadOrWrite)[number]>();
          const usedCatch = new Set<string>();
          const usedTry = new Set<string>();
          for (const file of context.files(FUNCTIONS_CODE)) {
            const { catches, tries } = swallowedFailures(file, facts);
            for (const { node, receiver } of catches) {
              const shape = facts.notReadOrWrite.find(
                (s) => s.file === file.path && new RegExp(s.pattern.source, s.pattern.flags.replace('g', '')).test(receiver),
              );
              if (shape) {
                usedShapes.add(shape);
                continue;
              }
              const site = facts.catchSites.find((s) => s.file === file.path && receiver.startsWith(s.receiver));
              if (site) usedCatch.add(`${site.file} ${site.receiver}`);
              else findings.push({ file: file.path, line: lineOfNode(file, node), detail: `.catch on ${receiver.slice(0, 60)} neither rethrows nor captures` });
            }
            for (const { node, fn } of tries) {
              const key = `${file.path} ${fn}`;
              if (facts.tryCatchSites.some((s) => `${s.file} ${s.function}` === key)) usedTry.add(key);
              else findings.push({ file: file.path, line: lineOfNode(file, node), detail: `try/catch around a read or write in ${fn} neither rethrows, captures, nor records the failure` });
            }
          }
          for (const s of facts.notReadOrWrite) {
            if (!usedShapes.has(s)) findings.push({ file: s.file, detail: `stale shape ${String(s.pattern)}: no caught expression in this file matches it` });
          }
          for (const s of facts.catchSites) if (!usedCatch.has(`${s.file} ${s.receiver}`)) findings.push({ file: s.file, detail: `stale catch site: no swallowing .catch on ${s.receiver}` });
          for (const s of facts.tryCatchSites) if (!usedTry.has(`${s.file} ${s.function}`)) findings.push({ file: s.file, detail: `stale try/catch site: ${s.function} keeps no failure` });
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Every post-commit effect captures its failure.

export interface PostCommitCaptureFacts {
  /** The comment text that marks a post-commit side effect. */
  marker: string;
  /** The monitoring capture calls. */
  captureCalls: readonly string[];
  /**
   * Reviewed best-effort helpers a marked effect may delegate to, each held to a shape that cannot
   * throw: a leaf runs its work in one capturing try; a delegating helper only calls captures and
   * reviewed helpers.
   */
  helpers: ReadonlyArray<{ name: string; file: string; why: string; delegates?: boolean }>;
}

/** Builtins a delegating helper may call: none throws on the arguments a helper passes. */
const PURE_BUILTINS = new Set(['Date.now', 'Math.max', 'Math.min', 'Array.from', 'Promise.all']);

/** Visit a subtree without entering nested function bodies (their code runs only where it is called). */
function forEachOutsideFunctions(node: ts.Node, visit: (n: ts.Node) => void): void {
  const walk = (n: ts.Node) => {
    visit(n);
    if (ts.isFunctionLike(n) && n !== node) return;
    ts.forEachChild(n, walk);
  };
  walk(node);
}

/** The post-commit checker for one app's capture calls and reviewed helpers. */
export function postCommitChecker(facts: Pick<PostCommitCaptureFacts, 'captureCalls' | 'helpers' | 'marker'>) {
  const captures = new Set(facts.captureCalls);
  const helperNames = new Set(facts.helpers.map((h) => h.name));

  const reachesCapture = (node: ts.Node): boolean => {
    let found = false;
    forEachNode(node, (n) => {
      if (found || !ts.isCallExpression(n)) return;
      const name = calleeName(n);
      if (name && (captures.has(name) || helperNames.has(name))) found = true;
    });
    return found;
  };
  const throwingCatches = (node: ts.Node, file: FileView): number[] => {
    const lines: number[] = [];
    forEachOutsideFunctions(node, (n) => {
      if (!ts.isCatchClause(n)) return;
      let throws = false;
      forEachOutsideFunctions(n.block, (m) => {
        if (ts.isThrowStatement(m)) throws = true;
      });
      if (throws) lines.push(lineOfNode(file, n));
    });
    return lines;
  };
  const captureFault = (body: ts.Node, file: FileView): string | null => {
    const silent: number[] = [];
    forEachNode(body, (n) => {
      if (ts.isCatchClause(n) && !reachesCapture(n.block)) silent.push(lineOfNode(file, n));
    });
    if (silent.length) return `catch at line ${silent.join(', ')} does not capture`;
    const rethrowing = throwingCatches(body, file);
    if (rethrowing.length) return `catch at line ${rethrowing.join(', ')} throws`;
    if (!reachesCapture(body)) return 'nothing in it captures';
    return null;
  };
  const isCapturingTry = (stmt: ts.Statement, file: FileView) =>
    ts.isTryStatement(stmt) && !!stmt.catchClause && reachesCapture(stmt.catchClause.block) && throwingCatches(stmt.catchClause, file).length === 0;

  const helperShapeFault = (body: ts.Node, file: FileView, delegates: boolean): string | null => {
    const fn = ts.isArrowFunction(body) || ts.isFunctionExpression(body) ? body.body : body;
    if (delegates) {
      let reviewed = false;
      const stray: string[] = [];
      forEachNode(fn, (n) => {
        if (!ts.isCallExpression(n)) return;
        const name = calleeName(n);
        const path = calleePath(n);
        if (name && helperNames.has(name)) reviewed = true;
        else if (!(name && captures.has(name)) && !(path && PURE_BUILTINS.has(path))) stray.push(path ?? name ?? '?');
      });
      if (stray.length) return `a delegating helper calls ${stray.join(', ')}`;
      return reviewed ? null : 'a delegating helper calls no reviewed helper';
    }
    if (!ts.isBlock(fn)) return 'a leaf helper body is not a block';
    const statements = [...fn.statements];
    const last = statements.pop();
    const loopOfOneTry =
      !!last &&
      ts.isForOfStatement(last) &&
      !last.awaitModifier &&
      ts.isBlock(last.statement) &&
      last.statement.statements.length === 1 &&
      isCapturingTry(last.statement.statements[0]!, file);
    if (!last || !(isCapturingTry(last, file) || loopOfOneTry)) return 'a leaf helper does not end in one capturing try (or a loop of one)';
    for (const stmt of statements) {
      let fault: string | null = null;
      forEachOutsideFunctions(stmt, (n) => {
        if (fault) return;
        if (ts.isAwaitExpression(n)) fault = 'awaits before its try';
        if (ts.isCallExpression(n)) {
          const path = calleePath(n);
          if (!path || !(path === 'Date.now' || path.startsWith('logger.'))) fault = `calls ${path ?? '?'} before its try`;
        }
      });
      if (fault) return `a leaf helper ${fault}`;
    }
    return null;
  };

  /** Every marked statement or function in a file that fails to capture. */
  const uncaptured = (file: FileView): Array<{ node: ts.Node; fault: string }> => {
    const sf = file.sourceFile;
    const text = sf.getFullText();
    const out: Array<{ node: ts.Node; fault: string }> = [];
    const marked = (node: ts.Node) =>
      (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []).some((r) => text.slice(r.pos, r.end).includes(facts.marker));
    forEachNode(sf, (node) => {
      if (node === sf || ts.isBlock(node) || !(ts.isStatement(node) || ts.isFunctionDeclaration(node)) || !marked(node)) return;
      const body = ts.isFunctionDeclaration(node) && node.body ? node.body : node;
      const fault = captureFault(body, file);
      if (fault) out.push({ node, fault });
    });
    return out;
  };

  /** The body of one named helper in its file. */
  const helperBody = (file: FileView, name: string): ts.Node | undefined => {
    let body: ts.Node | undefined;
    forEachNode(file.sourceFile, (n) => {
      if (body) return;
      if (ts.isFunctionDeclaration(n) && n.name?.text === name && n.body) body = n.body;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) body = n.initializer;
    });
    return body;
  };

  const helperFault = (file: FileView, helper: { name: string; delegates?: boolean }): string | null => {
    const body = helperBody(file, helper.name);
    if (!body) return `${helper.name} is not declared in it`;
    return captureFault(body, file) ?? helperShapeFault(body, file, helper.delegates === true);
  };

  const countMarkers = (file: FileView) => file.text.split(facts.marker).length - 1;

  return { uncaptured, helperFault, countMarkers };
}

export const postCommitCaptureGuard: GenericGuardDefinition<PostCommitCaptureFacts> = {
  id: 'postCommitCapture',
  absentWhen: 'the app commits no post-commit side effects',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.marker, 'marker', problems);
    namesProblem(facts?.captureCalls, 'captureCalls', problems);
    reviewedProblems(facts?.helpers, 'helpers', problems, { key: 'name' });
    for (const helper of facts?.helpers ?? []) if (!helper?.file) problems.push(`helper ${String(helper?.name)} names no file`);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every post-commit side effect captures its failure',
        description:
          `Every statement or function marked "${facts.marker}" captures its failure through the monitoring capture calls ` +
          '(directly, or through a reviewed best-effort helper), and no catch inside it rethrows or only logs: the work ' +
          'already committed, so its failure surfaces nowhere else. Each reviewed helper is held, in its own file, to a ' +
          'shape that cannot throw — a leaf ends in one capturing try (or a loop of one) with nothing but logging before ' +
          'it; a delegating helper calls only captures, reviewed helpers, and pure builtins.',
        run(context) {
          const check = postCommitChecker(facts);
          const files = context.files(FUNCTIONS_CODE);
          const byPath = new Map(files.map((f) => [f.path, f]));
          const findings: Finding[] = [];
          let markers = 0;
          for (const file of files) {
            markers += check.countMarkers(file);
            for (const { node, fault } of check.uncaptured(file)) findings.push({ file: file.path, line: lineOfNode(file, node), detail: fault });
          }
          if (!markers) findings.push({ file: '(marker)', detail: `no file carries the marker "${facts.marker}", so the guard checks nothing` });
          for (const helper of facts.helpers) {
            const file = byPath.get(helper.file);
            if (!file) findings.push({ file: helper.file, detail: `reviewed helper ${helper.name}: the file is gone or outside the Functions tree` });
            else {
              const fault = check.helperFault(file, helper);
              if (fault) findings.push({ file: helper.file, detail: `reviewed helper ${helper.name}: ${fault}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// A scheduled handler isolates its passes.

export interface ScheduledPassFacts {
  /** Tries whose second awaited unit depends on the first, by file and the exact units, each with its why. */
  dependentUnits: ReadonlyArray<{ file: string; units: readonly string[]; why: string }>;
}

const isLoop = (node: ts.Node) =>
  ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node);

function containsAwait(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found || ts.isFunctionLike(child)) return;
    if (ts.isAwaitExpression(child) || (ts.isForOfStatement(child) && child.awaitModifier)) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

/** The awaited units a try block holds itself: each awaited call, and each loop that awaits. */
function awaitedUnits(block: ts.Block, sf: ts.SourceFile): string[] {
  const units: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTryStatement(node) || ts.isFunctionLike(node)) return;
    if (isLoop(node) && containsAwait(node)) {
      units.push('loop');
      return;
    }
    if (ts.isAwaitExpression(node)) {
      const e = node.expression;
      units.push(ts.isCallExpression(e) ? (calleeName(e) ?? 'call') : e.getText(sf));
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(block, visit);
  return units;
}

/** Every try inside an `onSchedule(…)` handler whose own statements await two or more units. */
export function multiPassTries(file: FileView): Array<{ node: ts.Node; units: string[] }> {
  const sf = file.sourceFile;
  const out: Array<{ node: ts.Node; units: string[] }> = [];
  const inHandler = (node: ts.Node): void => {
    if (ts.isTryStatement(node)) {
      const units = awaitedUnits(node.tryBlock, sf);
      if (units.length > 1) out.push({ node, units });
    }
    ts.forEachChild(node, inHandler);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && calleeName(node) === 'onSchedule') {
      node.arguments.forEach(inHandler);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export const scheduledPassGuard: GenericGuardDefinition<ScheduledPassFacts> = {
  id: 'scheduledPassIsolation',
  absentWhen: 'the app runs no scheduled functions',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.dependentUnits, 'dependentUnits', problems, {
      key: 'file',
      id: (e) => (Array.isArray(e.units) && e.units.length > 1 ? `${e.file} ${(e.units as string[]).join(', ')}` : undefined),
      idNames: 'second unit',
    });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'a scheduled handler isolates its passes',
        description:
          "A scheduled handler that runs independent passes gives each its own try, so one pass's throw never skips the " +
          'next: a try inside an `onSchedule(…)` handler holds at most one awaited unit (one awaited call, or one loop that ' +
          'awaits). A job with several passes extracts them into one function that isolates each. A try whose second unit ' +
          'depends on the first is a reviewed entry naming the file and its exact units; an entry that matches nothing is ' +
          'stale. The scan must find at least one scheduled handler.',
        run(context) {
          const findings: Finding[] = [];
          const reviewed = new Set(facts.dependentUnits.map((e) => `${e.file} ${e.units.join(', ')}`));
          const matched = new Set<string>();
          let handlers = 0;
          for (const file of context.files(FUNCTIONS_CODE)) {
            forEachNode(file.sourceFile, (n) => {
              if (ts.isCallExpression(n) && calleeName(n) === 'onSchedule') handlers += 1;
            });
            for (const { node, units } of multiPassTries(file)) {
              const key = `${file.path} ${units.join(', ')}`;
              if (reviewed.has(key)) matched.add(key);
              else findings.push({ file: file.path, line: lineOfNode(file, node), detail: `one try awaits ${units.length} passes: ${units.join(', ')}` });
            }
          }
          if (!handlers) findings.push({ file: '(functions)', detail: 'no onSchedule handler found, so the guard checks nothing' });
          for (const key of reviewed) if (!matched.has(key)) findings.push({ file: key.split(' ')[0]!, detail: `stale dependent-unit entry: ${key}` });
          return findings;
        },
      },
    ];
  },
};
