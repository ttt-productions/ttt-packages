// The guards over how code names a Firestore path:
//   - no typed path segment reaches a Firestore accessor, on either SDK;
//   - no path is assembled by hand from an owner constant, a slash, and a hole;
//   - no retired segment name survives in a path string.
// Each reads the syntax tree, so a comment is never a hit and a newline is never an escape hatch.

import ts from 'typescript';
import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import type { Reviewed } from '../../node/layout.js';
import type { FileView } from '../../reader/view.js';
import { calleeName, forEachNode, isPlainString, lineOfNode, unwrap } from '../../support/ast.js';
import { namesProblem, reviewedProblems, takesNoFacts } from '../../support/facts.js';
import { escapeRegExp } from '../../support/text.js';
import {
  bannedGuard,
  findingsOf,
  isMemberOf,
  literalBindings,
  type NoFacts,
  type NodeHit,
} from './support.js';

const ACCESSORS = new Set(['collection', 'collectionGroup', 'doc']);

const APP_CODE: Scope = { roots: ['app', 'functions'], optionalRoots: ['functions'], kinds: ['code'], tests: false };

/** The database handle a modular accessor takes first: `db`, `firestore.db`, `getDb()`. */
function isHandle(node: ts.Expression): boolean {
  const plain = (n: ts.Expression): boolean =>
    ts.isIdentifier(n) || (ts.isPropertyAccessExpression(n) && plain(n.expression));
  return plain(node) || (ts.isCallExpression(node) && node.arguments.length === 0 && plain(node.expression));
}

/**
 * The path arguments of a Firestore accessor call, or null when the call is not one:
 * `x.collection(…)` / `x.collectionGroup(…)` / `x.doc(…)` (every argument), and the modular
 * `collection(db, …)` / `collectionGroup(db, …)` / `doc(db, …)` (every argument after the handle).
 */
function accessorPathArguments(call: ts.CallExpression): { form: 'method' | 'modular'; args: readonly ts.Expression[] } | null {
  const callee = call.expression;
  if (ts.isPropertyAccessExpression(callee) && ACCESSORS.has(callee.name.text)) return { form: 'method', args: call.arguments };
  if (ts.isIdentifier(callee) && ACCESSORS.has(callee.text) && call.arguments.length >= 2 && isHandle(call.arguments[0])) {
    return { form: 'modular', args: call.arguments.slice(1) };
  }
  return null;
}

/** Every typed segment reaching an accessor in one file: an inline literal or a file-local literal binding. */
export function literalSegmentHits(file: FileView): NodeHit[] {
  const source = file.sourceFile;
  const bindings = literalBindings(source);
  const typed = (arg: ts.Expression): string | null => {
    const value = unwrap(arg);
    if (isPlainString(value)) return `'${value.text}'`;
    if (ts.isIdentifier(value) && bindings.has(value.text)) return `${value.text} (bound to '${bindings.get(value.text)}')`;
    return null;
  };
  const hits: NodeHit[] = [];
  forEachNode(source, (node) => {
    if (!ts.isCallExpression(node)) return;
    const accessor = accessorPathArguments(node);
    if (!accessor) return;
    const name = calleeName(node);
    if (accessor.form === 'method') {
      // The Admin SDK accessor takes the whole segment as its one argument.
      if (accessor.args.length !== 1) return;
      const segment = typed(accessor.args[0]);
      if (segment) hits.push({ node: (node.expression as ts.PropertyAccessExpression).name, detail: `.${name}(${segment})` });
      return;
    }
    const segments = accessor.args.filter((arg) => !ts.isSpreadElement(arg)).map(typed).filter((s): s is string => s !== null);
    if (segments.length) hits.push({ node, detail: `${name}(db, …) with ${segments.join(', ')}` });
  });
  return hits;
}

export const literalSegmentGuard: GenericGuardDefinition<NoFacts> = {
  id: 'firestoreLiteralSegments',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems: takesNoFacts,
  build() {
    return [
      bannedGuard({
        title: 'no typed path segment reaches a Firestore accessor',
        description:
          'A collection or document segment comes from the core package, never a string typed at the call. Flagged: a ' +
          'string literal (or a name bound to one in the same file) as the whole argument of x.collection / ' +
          'x.collectionGroup / x.doc, on every link of a chain, and in ANY path position after the handle of the ' +
          'modular collection(db, …) / collectionGroup(db, …) / doc(db, …). A literal whose text equals the constant is ' +
          "still the violation. Fix: import the owner — the core's collection constant, or its path builder.",
        scope: APP_CODE,
        match: literalSegmentHits,
      }),
    ];
  },
};

export interface PathAssemblyFacts {
  /** The core's path-owner constant maps (`COLLECTIONS`): a member of one spliced into a path is assembly. */
  ownerConstants: readonly string[];
  /** Path joiners that take a segment array (`toPath`); an array literal holding an owner member is assembly. */
  segmentArrayJoiners: readonly string[];
  /** Files reviewed to assemble a path by hand, each with its why. An entry with no assembly left is stale. */
  reviewedSites: readonly Reviewed[];
}

const hasSlash = (node: ts.Expression) => isPlainString(node) && node.text.includes('/');

/** The operands of a `+` chain, flattened. */
function concatenationOperands(node: ts.Expression): ts.Expression[] {
  const value = unwrap(node);
  if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...concatenationOperands(value.left), ...concatenationOperands(value.right)];
  }
  return [value];
}

/** Every hand-assembled path in one file, under the app's owner constants and joiners. */
export function pathAssemblyHits(file: FileView, facts: Pick<PathAssemblyFacts, 'ownerConstants' | 'segmentArrayJoiners'>): NodeHit[] {
  const owners = new Set(facts.ownerConstants);
  const joiners = new Set(facts.segmentArrayJoiners);
  const isOwner = (node: ts.Expression) => isMemberOf(unwrap(node), owners);
  const hits = new Map<number, NodeHit>();
  const hit = (node: ts.Node, detail: string) => {
    const at = node.getStart(file.sourceFile);
    if (!hits.has(at)) hits.set(at, { node, detail });
  };
  forEachNode(file.sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const accessor = accessorPathArguments(node);
      for (const raw of accessor?.args ?? []) {
        const arg = unwrap(raw);
        if (ts.isTemplateExpression(arg)) {
          if (arg.templateSpans.some((span) => isOwner(span.expression))) hit(arg, 'an owner constant spliced into a template path');
          else if ((arg.head.text + arg.templateSpans.map((s) => s.literal.text).join('')).includes('/')) {
            hit(arg, 'a template path built from a `/` and a hole');
          }
        } else if (ts.isBinaryExpression(arg) && concatenationOperands(arg).some(hasSlash)) {
          hit(arg, 'a slash path concatenated at the accessor');
        }
      }
      const name = calleeName(node);
      if (name && joiners.has(name)) {
        for (const arg of node.arguments) {
          const value = unwrap(arg);
          if (ts.isArrayLiteralExpression(value) && value.elements.some((e) => !ts.isSpreadElement(e) && isOwner(e))) {
            hit(value, `a segment array handed to ${name}() with an owner constant in it`);
          }
        }
      }
    } else if (ts.isTemplateExpression(node)) {
      node.templateSpans.forEach((span, i) => {
        const followedByHole = i < node.templateSpans.length - 1;
        if (isOwner(span.expression) && span.literal.text === '/' && followedByHole) {
          hit(node, 'an owner constant joined to a hole with a `/`');
        }
      });
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = unwrap(node.left);
      const right = unwrap(node.right);
      if ((isOwner(left) && hasSlash(right)) || (hasSlash(left) && isOwner(right))) hit(node, 'an owner constant concatenated with a slash');
    }
  });
  return [...hits.values()].sort((a, b) => a.node.getStart(file.sourceFile) - b.node.getStart(file.sourceFile));
}

export const pathAssemblyGuard: GenericGuardDefinition<PathAssemblyFacts> = {
  id: 'firestorePathAssembly',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.ownerConstants, 'ownerConstants', problems);
    namesProblem(facts?.segmentArrayJoiners, 'segmentArrayJoiners', problems, { nonEmpty: false });
    reviewedProblems(facts?.reviewedSites, 'reviewedSites', problems);
    return problems;
  },
  build(facts) {
    const reviewed = new Map(facts.reviewedSites.map((s) => [s.path, s]));
    return [
      {
        title: 'no Firestore path is assembled by hand',
        description:
          "A path's string form derives from the core's path builder; writing it again at the call is a second spelling. " +
          'Flagged: an owner constant spliced into an accessor template; an accessor template holding both a `/` and a ' +
          'hole, in either order; a slash-bearing literal concatenated in an accessor argument; an owner constant joined ' +
          'to a hole by a `/` in any template, or concatenated with a slash-bearing literal anywhere; a segment array ' +
          "holding an owner constant handed to a path joiner. Fix: call the core's path builder. A reviewed site is a file " +
          'with its why; an entry whose file no longer assembles a path is stale.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          const held = new Set<string>();
          for (const file of context.files(APP_CODE)) {
            const hits = pathAssemblyHits(file, facts);
            if (!hits.length) continue;
            if (reviewed.has(file.path)) held.add(file.path);
            else findings.push(...findingsOf(file, hits));
          }
          for (const path of reviewed.keys()) {
            if (!held.has(path)) findings.push({ file: path, detail: 'stale reviewed site: the file no longer assembles a path (or is gone)' });
          }
          return findings;
        },
      },
    ];
  },
};

export interface RetiredSegmentFacts {
  /** Segment names the app retired, each with what it became. */
  segments: ReadonlyArray<{ name: string; replacement: string }>;
  /** Literals reviewed to hold a retired word in path position that is not a Firestore segment. */
  reviewedMatches: ReadonlyArray<{ file: string; contains: string; why: string }>;
}

/**
 * Every retired name in path position in one file: `/name/`, `/name` closing a literal, or the
 * whole group id of a collectionGroup call. Each hit carries the literal's source text, which a
 * reviewed match is checked against.
 */
export function retiredSegmentHits(file: FileView, names: readonly string[]): Array<NodeHit & { name: string; text: string }> {
  const source = file.sourceFile;
  const retired = new Set(names);
  const alternation = names.map(escapeRegExp).join('|');
  const inside = new RegExp(`/(${alternation})(?=/)`, 'g');
  const closing = new RegExp(`/(${alternation})$`);
  const hits: Array<NodeHit & { name: string; text: string }> = [];
  const scan = (node: ts.Node, parts: Array<{ text: string; closes: boolean }>) => {
    const found: string[] = [];
    for (const { text, closes } of parts) {
      for (const m of text.matchAll(inside)) found.push(m[1]);
      const end = closes ? closing.exec(text) : null;
      if (end) found.push(end[1]);
    }
    for (const name of found) hits.push({ node, name, text: node.getText(source), detail: '' });
  };
  forEachNode(source, (node) => {
    if (isPlainString(node)) scan(node, [{ text: node.text, closes: true }]);
    else if (ts.isTemplateExpression(node)) {
      scan(node, [
        { text: node.head.text, closes: false },
        ...node.templateSpans.map((s, i) => ({ text: s.literal.text, closes: i === node.templateSpans.length - 1 })),
      ]);
    }
    if (ts.isCallExpression(node) && calleeName(node) === 'collectionGroup') {
      for (const arg of node.arguments) {
        if (isPlainString(arg) && retired.has(arg.text)) hits.push({ node: arg, name: arg.text, text: arg.getText(source), detail: '' });
      }
    }
  });
  return hits;
}

export const retiredSegmentGuard: GenericGuardDefinition<RetiredSegmentFacts> = {
  id: 'firestoreRetiredSegments',
  absentWhen: 'the app has retired no Firestore segment name',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.reviewedMatches, 'reviewedMatches', problems, {
      key: 'file',
      id: (e) => (typeof e.contains === 'string' && e.contains ? `${e.file} ${e.contains}` : undefined),
      idNames: 'text it contains',
    });
    if (!Array.isArray(facts?.segments) || !facts.segments.length) return [...problems, 'segments is empty (declare the guard absent instead)'];
    const names = facts.segments.map((s) => s?.name);
    for (const s of facts.segments) {
      if (typeof s?.name !== 'string' || !/^[\w$-]+$/.test(s.name)) problems.push(`segments: ${String(s?.name)} is not a segment name`);
      if (typeof s?.replacement !== 'string' || !s.replacement.trim()) problems.push(`segments: ${String(s?.name)} names no replacement`);
    }
    if (new Set(names).size !== names.length) problems.push('segments names one entry twice');
    return problems;
  },
  build(facts) {
    const replacement = new Map(facts.segments.map((s) => [s.name, s.replacement]));
    const names = [...replacement.keys()];
    const scope: Scope = {
      roots: ['app', 'functions', 'scripts', 'e2e', 'hostedE2e', 'workers'],
      optionalRoots: ['functions', 'scripts', 'e2e', 'hostedE2e', 'workers'],
      kinds: ['code'],
      tests: true,
    };
    return [
      {
        title: 'no retired Firestore segment survives in a path string',
        description:
          'A segment name inside a string is never type-checked, so a retired name keeps addressing a collection that no ' +
          'longer exists — a trigger that never fires, a read that returns nothing, a fixture nobody reads. Flagged: a ' +
          'retired name in path position in any string or template (`/name/`, or `/name` closing it), and a retired name ' +
          "as a collectionGroup id. Fix: build the path through the core. A reviewed match names a literal's text that " +
          'is not a Firestore path, with its why; one that matches nothing is stale.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          const used = new Set<number>();
          for (const file of context.files(scope)) {
            for (const hit of retiredSegmentHits(file, names)) {
              const index = facts.reviewedMatches.findIndex((r) => r.file === file.path && hit.text.includes(r.contains));
              if (index !== -1) {
                used.add(index);
                continue;
              }
              findings.push({
                file: file.path,
                line: lineOfNode(file, hit.node),
                detail: `retired segment '${hit.name}' (now '${replacement.get(hit.name)}') in ${hit.text.slice(0, 80)}`,
              });
            }
          }
          facts.reviewedMatches.forEach((r, i) => {
            if (!used.has(i)) findings.push({ file: r.file, detail: `stale reviewed match: no retired segment in a literal containing "${r.contains}"` });
          });
          return findings;
        },
      },
    ];
  },
};
