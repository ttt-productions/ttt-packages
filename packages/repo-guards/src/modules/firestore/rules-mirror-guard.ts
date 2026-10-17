// The Firestore rules mirror the core exactly: every collection the core declares has its own
// `match` block and every block names a declared collection, no block spans an unnamed collection,
// and every fixed document, status, and role the rules spell is a value the core declares.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import {
  documentPathLiterals,
  isRecursive,
  isVariable,
  matchBlocks,
  normalizeDeclared,
  normalizePath,
  rulesFunctions,
  type Loaded,
  type MatchBlock,
  type RulesFunction,
} from './rules-syntax.js';
import { closerOf, fieldOf, loneString, operandAfter, operandBefore, tokenize, type Token } from './rules-tokens.js';
import { requireLoader, requireName } from './support.js';

export interface RulesMirrorFacts {
  /** The repo-relative Firestore rules file. */
  rulesFile: string;
  /**
   * Every collection the core declares, as its path from the root with a `{variable}` for each
   * parent document and a parent's fixed id written as itself: `users`, `users/{userId}/settings`,
   * `feed/active/posts`.
   */
  collections: Loaded<readonly string[]>;
  /** Every collection group the core declares (a `{path=**}` block's collection). */
  collectionGroups: Loaded<readonly string[]>;
  /** Every fixed document the core declares, as its full path: `config/app`, `users/{userId}/meta/settings`. */
  fixedDocuments: Loaded<readonly string[]>;
  /** Each stored field the rules compare to a quoted value, with every value the core declares for it. */
  comparedFields: ReadonlyArray<{ field: string; values: Loaded<readonly string[]> }>;
  /** Each rules function that spells one list of declared values (a role or standing list), with that list. */
  valueLists: ReadonlyArray<{ function: string; values: Loaded<readonly string[]> }>;
}

/** The Firestore service root every collection block sits under. */
const isServiceRoot = (block: MatchBlock) =>
  block.segments.length === 3 && block.segments[0] === 'databases' && isVariable(block.segments[1]) && block.segments[2] === 'documents';

interface Declared {
  collections: Set<string>;
  groups: Set<string>;
  fixed: Set<string>;
  fields: Map<string, Set<string>>;
}

/** Every way the blocks drift from the declared collections, one finding each. */
function blockFindings(code: string, declared: Declared, at: (index: number) => number, file: string): Finding[] {
  const findings: Finding[] = [];
  const blocks = matchBlocks(code);
  const root = blocks.find(isServiceRoot);
  if (!root) return [{ file, detail: 'no match /databases/{database}/documents block, so no collection block can be read' }];
  const covered = new Set<string>();
  for (const block of blocks) {
    if (block === root) continue;
    const line = at(block.index);
    let under: MatchBlock | null = block.parent;
    while (under && under !== root) under = under.parent;
    if (!under) {
      findings.push({ file, line, detail: `the block match ${block.path} sits outside the documents root` });
      continue;
    }
    const segments = block.segments.slice(3);
    const shown = `/${segments.join('/')}`;
    if (segments.some(isRecursive)) {
      const direct = block.parent === root;
      if (direct && segments.length === 1) {
        const body = code.slice(block.open + 1, block.close);
        const statements = [...body.matchAll(/\ballow\b[^;]*;/g)].map((m) => m[0]);
        const grants = statements.filter((s) => !/^allow\s+[\w\s,]+:\s*if\s+false\s*;$/.test(s));
        if (grants.length || /\bmatch\b/.test(body)) findings.push({ file, line, detail: `the catch-all ${shown} grants something; it only denies` });
      } else if (direct && segments.length === 3 && isRecursive(segments[0]) && !isVariable(segments[1]) && isVariable(segments[2]) && !isRecursive(segments[2])) {
        if (!declared.groups.has(segments[1])) findings.push({ file, line, detail: `the collection-group block ${shown} names ${segments[1]}, which the core declares as no collection group` });
      } else {
        findings.push({ file, line, detail: `the block ${shown} spans collections it does not name; only the top-level deny-all catch-all and a {path=**}/<group>/{id} collection-group block may hold a recursive wildcard` });
      }
      continue;
    }
    const wildcard = segments.find((s, i) => i % 2 === 0 && isVariable(s));
    if (wildcard) {
      findings.push({ file, line, detail: `the block ${shown} matches any collection name with ${wildcard}; give each declared collection its own block` });
      continue;
    }
    if (segments.length % 2 === 1) {
      findings.push({ file, line, detail: `the block ${shown} ends on a collection, not a document` });
      continue;
    }
    const collection = normalizePath(segments.slice(0, -1));
    if (!declared.collections.has(collection)) {
      findings.push({ file, line, detail: `the block ${shown} names the collection ${collection}, which the core does not declare` });
      continue;
    }
    covered.add(collection);
    const leaf = segments[segments.length - 1];
    if (!isVariable(leaf) && !declared.fixed.has(normalizePath(segments))) {
      findings.push({ file, line, detail: `the block ${shown} names the fixed document ${normalizePath(segments)}, which the core does not declare` });
    }
  }
  for (const collection of [...declared.collections].sort()) {
    if (!covered.has(collection)) findings.push({ file, detail: `no match block of its own for the declared collection ${collection}` });
  }
  return findings;
}

/** Every document path the rules read that names an undeclared collection or fixed document. */
function readFindings(code: string, declared: Declared, at: (index: number) => number, file: string): Finding[] {
  const findings: Finding[] = [];
  for (const p of documentPathLiterals(code)) {
    const line = at(p.index);
    const segments = p.segments;
    if (segments.some((s, i) => i % 2 === 0 && s === '{}')) {
      findings.push({ file, line, detail: `the read ${p.text} builds a collection name at run time` });
      continue;
    }
    const docPath = segments.length % 2 === 0;
    const collection = normalizePath(docPath ? segments.slice(0, -1) : segments);
    if (!declared.collections.has(collection)) {
      findings.push({ file, line, detail: `the read ${p.text} names the collection ${collection}, which the core does not declare` });
      continue;
    }
    if (docPath && segments[segments.length - 1] !== '{}' && !declared.fixed.has(normalizePath(segments))) {
      findings.push({ file, line, detail: `the read ${p.text} names the fixed document ${normalizePath(segments)}, which the core does not declare` });
    }
  }
  return findings;
}

const LIST_METHODS = new Set(['hasAny', 'hasAll', 'hasOnly']);

type Verb = 'compares' | 'tests' | 'lists';

/** The stored fields a function's `param` is compared against, following it through the file's own calls. */
function fieldsOfParam(fn: RulesFunction, param: string, tokens: readonly Token[], functions: Map<string, RulesFunction>, seen: Set<string>): Set<string> {
  const fields = new Set<string>();
  const key = `${fn.name}#${param}`;
  if (seen.has(key)) return fields;
  seen.add(key);
  const body = tokens.filter((t) => t.index >= fn.bodyStart && t.index < fn.bodyEnd);
  body.forEach((t, i) => {
    if (t.kind !== 'name' || t.text !== param || body[i - 1]?.text === '.') return;
    if (body[i - 1]?.text === 'in') {
      const field = fieldOf(body, operandBefore(body, i - 1));
      if (field) fields.add(field);
      return;
    }
    const call = callAround(body, i);
    if (!call) return;
    if (call.member && LIST_METHODS.has(call.name)) {
      const field = fieldOf(body, operandBefore(body, call.open - 1));
      if (field) fields.add(field);
    } else if (!call.member && functions.has(call.name)) {
      const callee = functions.get(call.name) as RulesFunction;
      const p = callee.params[call.argIndex];
      if (p) for (const f of fieldsOfParam(callee, p, tokens, functions, seen)) fields.add(f);
    }
  });
  return fields;
}

/** The call whose argument list holds token `i` directly: its name, whether it is a `.member(` call, and the argument's position. */
function callAround(tokens: readonly Token[], i: number): { name: string; member: boolean; open: number; argIndex: number } | null {
  let depth = 0;
  let commas = 0;
  for (let j = i - 1; j >= 0; j -= 1) {
    const t = tokens[j];
    if (t.text === ')' || t.text === ']' || t.text === '}') depth += 1;
    else if (t.text === '(' || t.text === '[' || t.text === '{') {
      if (depth === 0) {
        if (t.text !== '(') return null;
        const callee = tokens[j - 1];
        if (!callee || callee.kind !== 'name') return null;
        return { name: callee.text, member: tokens[j - 2]?.text === '.', open: j - 1, argIndex: commas };
      }
      depth -= 1;
    } else if (depth === 0 && t.text === ',') commas += 1;
  }
  return null;
}

/** Every quoted value the rules compare to a stored field, checked against the field's declared values. */
function valueFindings(code: string, declared: Declared, at: (index: number) => number, file: string): Finding[] {
  const tokens = tokenize(code);
  const functions = rulesFunctions(code);
  const findings: Finding[] = [];
  const phrase = (how: Verb, value: string, field: string) =>
    how === 'compares' ? `compares the field ${field} to '${value}'` : how === 'tests' ? `tests '${value}' for membership in the field ${field}` : `lists '${value}' for the field ${field}`;
  const check = (value: Token, field: string | null, how: Verb) => {
    const line = at(value.index);
    if (!field) {
      findings.push({ file, line, detail: `${how} '${value.text}' against something that is no stored field; compare a declared field, or name a fixed document as its own block` });
      return;
    }
    const values = declared.fields.get(field);
    if (!values) findings.push({ file, line, detail: `${phrase(how, value.text, field)}, and the config declares no values for ${field}` });
    else if (!values.has(value.text)) findings.push({ file, line, detail: `${phrase(how, value.text, field)}, which the core does not declare for it` });
  };

  tokens.forEach((t, i) => {
    if (t.kind === 'punct' && (t.text === '==' || t.text === '!=')) {
      const left = operandBefore(tokens, i);
      const right = operandAfter(tokens, i);
      const l = loneString(tokens, left);
      const r = loneString(tokens, right);
      if (l && !r) check(l, fieldOf(tokens, right), 'compares');
      else if (r && !l) check(r, fieldOf(tokens, left), 'compares');
    } else if (t.kind === 'name' && t.text === 'in') {
      const left = operandBefore(tokens, i);
      const right = operandAfter(tokens, i);
      const l = loneString(tokens, left);
      if (l && tokens[right[0]]?.text !== '[') check(l, fieldOf(tokens, right), 'tests');
    } else if (t.text === '[') {
      const prev = tokens[i - 1];
      const indexAccess = !!prev && ((prev.kind === 'name' && !['in', 'return', 'if'].includes(prev.text)) || prev.text === ')' || prev.text === ']');
      if (indexAccess) return;
      const close = closerOf(tokens, i);
      const items = tokens.slice(i + 1, close).filter((x) => x.kind === 'string');
      if (!items.length) return;
      let fields: Set<string> | null = null;
      if (prev?.text === 'in') {
        const field = fieldOf(tokens, operandBefore(tokens, i - 1));
        fields = new Set(field ? [field] : []);
      } else {
        const call = callAround(tokens, i);
        if (call?.member && call.name === 'get') return;
        if (call?.member && LIST_METHODS.has(call.name)) {
          const field = fieldOf(tokens, operandBefore(tokens, call.open - 1));
          fields = new Set(field ? [field] : []);
        } else if (call && !call.member && functions.has(call.name)) {
          const callee = functions.get(call.name) as RulesFunction;
          const p = callee.params[call.argIndex];
          fields = p ? fieldsOfParam(callee, p, tokens, functions, new Set()) : new Set();
        }
      }
      for (const item of items) {
        if (!fields || !fields.size) check(item, null, 'lists');
        else for (const field of fields) check(item, field, 'lists');
      }
    }
  });
  return findings;
}

/** A function's literal string lists: each `[…]` in its body that holds a quoted value. */
function literalLists(code: string, fn: RulesFunction): string[][] {
  const tokens = tokenize(code).filter((t) => t.index >= fn.bodyStart && t.index < fn.bodyEnd);
  const lists: string[][] = [];
  tokens.forEach((t, i) => {
    if (t.text !== '[') return;
    const items = tokens.slice(i + 1, closerOf(tokens, i)).filter((x) => x.kind === 'string').map((x) => x.text);
    if (items.length) lists.push(items);
  });
  return lists;
}

/** Every way the rules text drifts from the core's declarations, as findings. */
export async function rulesMirrorFindings(file: { path: string; code: string; lineOf(index: number): number }, facts: RulesMirrorFacts): Promise<Finding[]> {
  const findings: Finding[] = [];
  const config = (detail: string) => findings.push({ file: '(config)', detail });
  const collections = new Set<string>();
  for (const c of await facts.collections()) {
    const n = normalizeDeclared(c);
    if (n.split('/').length % 2 === 0 || n.split('/').some((s, i) => i % 2 === 0 && s === '{}')) config(`the declared collection ${c} is not a collection path`);
    collections.add(n);
  }
  const fixed = new Set<string>();
  for (const d of await facts.fixedDocuments()) {
    const n = normalizeDeclared(d);
    const parts = n.split('/');
    if (parts.length % 2 === 1 || parts[parts.length - 1] === '{}') config(`the declared fixed document ${d} is not a fixed document path`);
    fixed.add(n);
  }
  const groups = new Set(await facts.collectionGroups());
  const fields = new Map<string, Set<string>>();
  for (const f of facts.comparedFields) fields.set(f.field, new Set(await f.values()));
  if (!collections.size) config('the core declares no collection, so the check reads nothing');
  const declared: Declared = { collections, groups, fixed, fields };
  const at = (index: number) => file.lineOf(index);
  findings.push(...blockFindings(file.code, declared, at, file.path));
  findings.push(...readFindings(file.code, declared, at, file.path));
  findings.push(...valueFindings(file.code, declared, at, file.path));
  const functions = rulesFunctions(file.code);
  for (const list of facts.valueLists) {
    const fn = functions.get(list.function);
    if (!fn) {
      findings.push({ file: file.path, detail: `declares no ${list.function}() function` });
      continue;
    }
    const lists = literalLists(file.code, fn);
    const expected = [...(await list.values())].sort();
    if (lists.length !== 1) {
      findings.push({ file: file.path, line: at(fn.index), detail: `${list.function}() spells ${lists.length} value lists; it spells exactly one` });
      continue;
    }
    const listed = [...lists[0]].sort();
    if (JSON.stringify(listed) !== JSON.stringify(expected)) {
      findings.push({ file: file.path, line: at(fn.index), detail: `${list.function}() lists [${listed.join(', ')}], the core declares [${expected.join(', ')}]` });
    }
  }
  return findings;
}

export const rulesMirrorGuard: GenericGuardDefinition<RulesMirrorFacts> = {
  id: 'rulesMirrorCore',
  absentWhen: false,
  factProblems(facts) {
    const problems = [
      ...requireName(facts?.rulesFile, 'rulesFile'),
      ...requireLoader(facts?.collections, 'collections'),
      ...requireLoader(facts?.collectionGroups, 'collectionGroups'),
      ...requireLoader(facts?.fixedDocuments, 'fixedDocuments'),
    ];
    for (const [key, name] of [['comparedFields', 'field'], ['valueLists', 'function']] as const) {
      const list = facts?.[key] as ReadonlyArray<Record<string, unknown>> | undefined;
      if (!Array.isArray(list)) {
        problems.push(`${key} is missing (declare [] when there is none)`);
        continue;
      }
      const seen = new Set<unknown>();
      for (const entry of list) {
        problems.push(...requireName(entry?.[name], `a ${key} ${name}`), ...requireLoader(entry?.values, `${key} ${String(entry?.[name])} values`));
        if (seen.has(entry?.[name])) problems.push(`${key}: ${String(entry?.[name])} is listed twice`);
        seen.add(entry?.[name]);
      }
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'the Firestore rules mirror the core exactly',
        description:
          'The Firestore rules cannot import the core, so their copy of it is pinned here. Every collection the core ' +
          'declares has its own explicit match block (top level, or under its declared parent) and every block names ' +
          'a declared collection; no block matches a collection name with a variable, and a recursive wildcard appears ' +
          'only in the top-level deny-all catch-all and in a {path=**}/<group>/{id} block naming a declared collection ' +
          'group. Every fixed document a block or a read spells, and every quoted value the rules compare a stored ' +
          'field to or list for it, is one the core declares; a function that spells a declared list spells it ' +
          'exactly. Fix: change the rules to match the core, or the core and the rules together.',
        async run(context) {
          return rulesMirrorFindings(context.file(facts.rulesFile), facts);
        },
      },
    ];
  },
};
