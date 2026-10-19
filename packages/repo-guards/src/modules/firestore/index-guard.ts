// Every filtered collection-group query has a collection-group-scoped index declared. The Firestore
// emulator enforces no index, so a missing one passes every local run and fails the query closed in
// every deployed project.

import ts from 'typescript';
import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { calleeName, forEachNode, isPlainString, lineOfNode, unwrap } from '../../support/ast.js';
import { loaderProblem, reviewedProblems, textProblem } from '../../support/facts.js';
import { literalBindings } from './support.js';

export interface CollectionGroupIndexFacts {
  /** The repo-relative index declaration file (`firestore.indexes.json`). */
  indexesFile: string;
  /** The core package's root exports, loaded at run time: `CONST.KEY` group ids resolve through them. */
  coreExports: () => Promise<Record<string, unknown>>;
  /** Call sites whose group id is not a static value, each with the groups and fields it really uses. */
  unresolvable: ReadonlyArray<{ file: string; argument: string; why: string }>;
}

interface IndexesFile {
  indexes?: Array<{
    collectionGroup: string;
    queryScope: string;
    fields: Array<{ fieldPath: string }>;
  }>;
  fieldOverrides?: Array<{
    collectionGroup: string;
    fieldPath: string;
    indexes?: Array<{ queryScope?: string }>;
  }>;
}

/** One collection-group query: its raw id argument, the resolved id (null when not static), and its filters. */
export interface GroupSite {
  file: string;
  line: number;
  argument: string;
  group: string | null;
  fields: string[];
}

/** The string field a `where('field', …)` call filters on, or null. */
function whereField(call: ts.CallExpression): string | null {
  if (calleeName(call) !== 'where') return null;
  const first = call.arguments[0];
  return first && isPlainString(first) ? first.text : null;
}

/** Every collection-group query in one file: the Admin chain `x.collectionGroup(g).where(…)…` and the modular `query(collectionGroup(db, g), where(…))`. */
export function collectionGroupSites(file: FileView, core: Record<string, unknown>): GroupSite[] {
  const source = file.sourceFile;
  const bindings = literalBindings(source);
  const resolve = (arg: ts.Expression): string | null => {
    const value = unwrap(arg);
    if (isPlainString(value)) return value.text;
    if (ts.isIdentifier(value)) return bindings.get(value.text) ?? null;
    if (ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.expression)) {
      const namespace = core[value.expression.text];
      const member =
        namespace && typeof namespace === 'object'
          ? (namespace as Record<string, unknown>)[value.name.text]
          : undefined;
      return typeof member === 'string' ? member : null;
    }
    return null;
  };
  const sites: GroupSite[] = [];
  forEachNode(source, (node) => {
    if (!ts.isCallExpression(node) || calleeName(node) !== 'collectionGroup') return;
    const callee = node.expression;
    let groupArg: ts.Expression | undefined;
    const fields: string[] = [];
    if (ts.isPropertyAccessExpression(callee)) {
      groupArg = node.arguments[0];
      // Walk up the chain the call heads: `.where(…)` links filter it.
      let link: ts.Node = node;
      while (
        ts.isPropertyAccessExpression(link.parent) &&
        ts.isCallExpression(link.parent.parent) &&
        link.parent.parent.expression === link.parent
      ) {
        const field = whereField(link.parent.parent);
        if (field) fields.push(field);
        link = link.parent.parent;
      }
    } else if (ts.isIdentifier(callee) && node.arguments.length >= 2) {
      groupArg = node.arguments[1];
      const outer = node.parent;
      if (
        ts.isCallExpression(outer) &&
        calleeName(outer) === 'query' &&
        outer.arguments[0] === node
      ) {
        for (const arg of outer.arguments.slice(1)) {
          const field = ts.isCallExpression(arg) ? whereField(arg) : null;
          if (field) fields.push(field);
        }
      }
    }
    if (!groupArg) return;
    sites.push({
      file: file.path,
      line: lineOfNode(file, node),
      argument: groupArg.getText(source),
      group: resolve(groupArg),
      fields,
    });
  });
  return sites;
}

/** Whether the declared indexes serve a collection-group query filtering on `fields`. */
export function isIndexed(indexes: IndexesFile, group: string, fields: readonly string[]): boolean {
  const unique = [...new Set(fields)];
  if (
    unique.length === 1 &&
    (indexes.fieldOverrides ?? []).some(
      (o) =>
        o.collectionGroup === group &&
        o.fieldPath === unique[0] &&
        (o.indexes ?? []).some((i) => i.queryScope === 'COLLECTION_GROUP'),
    )
  ) {
    return true;
  }
  return (indexes.indexes ?? []).some((i) => {
    if (i.collectionGroup !== group || i.queryScope !== 'COLLECTION_GROUP') return false;
    // A composite serves only its prefix, so one filtered field must lead it.
    if (unique.length === 1) return i.fields[0]?.fieldPath === unique[0];
    return unique.every((f) => i.fields.some((x) => x.fieldPath === f));
  });
}

const SCOPE: Scope = {
  roots: ['functions', 'app'],
  optionalRoots: ['functions'],
  kinds: ['code'],
  tests: false,
};

export const collectionGroupIndexGuard: GenericGuardDefinition<CollectionGroupIndexFacts> = {
  id: 'firestoreCollectionGroupIndexes',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.indexesFile, 'indexesFile', problems);
    loaderProblem(facts?.coreExports, 'coreExports', problems);
    reviewedProblems(facts?.unresolvable, 'unresolvable', problems, {
      key: 'file',
      id: (e) =>
        typeof e.argument === 'string' && e.argument.trim() ? `${e.file} ${e.argument}` : undefined,
      idNames: 'argument',
    });
    return problems;
  },
  build(facts) {
    const key = (file: string, argument: string) => `${file} :: ${argument}`;
    const reviewed = new Set(facts.unresolvable.map((e) => key(e.file, e.argument)));
    return [
      {
        title: 'every filtered collection-group query is index-backed',
        description:
          'A collection-group query needs its own collection-group-scoped index; the automatic single-field index is ' +
          'collection-scoped, and the emulator enforces none, so a missing one passes locally and fails closed when ' +
          'deployed. Every filtered collection-group query needs a matching collection-group field override (one field) ' +
          'or composite index (led by the field when there is one). Its group id must resolve to a static value — a ' +
          "literal, a same-file literal binding, or a core constant member — or be a reviewed site naming the call's " +
          'argument with its why. Fix: add the index entry the finding names.',
        timeoutMs: 120_000,
        async run(context) {
          const core = await facts.coreExports();
          const indexes = JSON.parse(context.file(facts.indexesFile).text) as IndexesFile;
          const findings: Finding[] = [];
          const seen = new Set<string>();
          for (const file of context.files(SCOPE)) {
            for (const site of collectionGroupSites(file, core)) {
              if (site.group === null) {
                const k = key(site.file, site.argument);
                seen.add(k);
                if (!reviewed.has(k)) {
                  findings.push({
                    file: site.file,
                    line: site.line,
                    detail: `collectionGroup(${site.argument}): the group id does not resolve to a static value`,
                  });
                }
                continue;
              }
              if (!site.fields.length || isIndexed(indexes, site.group, site.fields)) continue;
              const fields = [...new Set(site.fields)];
              findings.push({
                file: site.file,
                line: site.line,
                detail:
                  `collectionGroup('${site.group}') filtered on ${fields.join(', ')} has no COLLECTION_GROUP index — add ` +
                  (fields.length === 1
                    ? `a "fieldOverrides" entry for ${site.group}.${fields[0]} with a COLLECTION_GROUP index`
                    : `an "indexes" entry for ${site.group} scoped COLLECTION_GROUP over ${fields.join(', ')}`),
              });
            }
          }
          for (const e of facts.unresolvable) {
            if (!seen.has(key(e.file, e.argument)))
              findings.push({
                file: e.file,
                detail: `stale unresolvable site: no collectionGroup(${e.argument}) left`,
              });
          }
          return findings;
        },
      },
    ];
  },
};
