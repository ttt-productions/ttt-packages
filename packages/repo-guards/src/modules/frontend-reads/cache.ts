import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import {
  identifierProblem,
  loaderProblem,
  pathProblem,
  reviewedProblems,
  type Loader,
} from '../../support/facts.js';
import { escapeRegExp } from '../../support/text.js';
import {
  APP_CODE,
  alternation,
  callSpan,
  collapse,
  familyOf,
  filesUnder,
  identifierListProblem,
  infiniteKeyFamilies,
  isPrefix,
  keyModuleProblem,
  loadKeyObjects,
  pathListProblem,
  reachesInfinite,
  requiredFile,
  reviewedCallProblem,
  sampleKey,
  type KeyBuilders,
  type KeyModuleFacts,
  type ReviewedCall,
} from './shared.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const REGISTRY_FACTORY = 'createDomainEventInvalidator';
const EXACT = 'exact';

export interface RegistryFacts {
  path: string;
}

export function registryObjectCode(file: FileView): { name: string; code: string } | null {
  const sf = file.sourceFile;
  let name: string | null = null;
  const find = (node: ts.Node) => {
    if (
      !name &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === REGISTRY_FACTORY &&
      node.arguments[0] &&
      ts.isIdentifier(node.arguments[0])
    ) {
      name = node.arguments[0].text;
    }
    ts.forEachChild(node, find);
  };
  find(sf);
  if (!name) return null;
  let found: { name: string; code: string } | null = null;
  const visit = (node: ts.Node) => {
    if (
      !found &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      found = {
        name: name!,
        code: file.code.slice(node.initializer.getStart(sf), node.initializer.getEnd()),
      };
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const keyRefPattern = (objects: readonly string[]) =>
  new RegExp(`\\b(${alternation(objects)})\\.(\\w+)`, 'g');

export interface CacheInvalidationFacts {
  registry: RegistryFacts;
  keyModule: KeyModuleFacts;
  readTrees: readonly string[];
  familySuffix: string;
}

interface OwnedElsewhere {
  sessionOwner: string;
  memberRefreshes: readonly ReviewedCall[];
}

const CLEAR_CALL = /\.\s*(invalidateQueries|removeQueries|resetQueries)(\s*\()/g;
const CACHE_WRITE_CALL =
  /\b(refetchQueries|resetQueries|cancelQueries|setQueryData|setQueriesData|getQueryData|getQueriesData|invalidateQueries|removeQueries|ensureQueryData|prefetchQuery)\b/;

export function clearCalls(file: FileView): Array<{ index: number; call: string }> {
  return [...file.code.matchAll(CLEAR_CALL)].map((m) => {
    const name = (m.index ?? 0) + m[0].indexOf(m[1]);
    const open = (m.index ?? 0) + m[0].length - 1;
    return { index: name, call: collapse(callSpan(file.code, name, open)) };
  });
}

function lineAt(code: string, index: number): string {
  const start = code.lastIndexOf('\n', index - 1) + 1;
  const end = code.indexOf('\n', index);
  return code.slice(start, end === -1 ? code.length : end);
}

export function readKeyFamilies(
  files: ReadonlyArray<{ code: string }>,
  objects: readonly string[],
  familySuffix: string,
): Set<string> {
  const read = new Set<string>();
  const names = alternation(objects);
  // Matched over the whole file, so a key Prettier wraps onto the next line still reads.
  for (const { code } of files) {
    for (const m of code.matchAll(new RegExp(`\\bqueryKey\\s*[:=]\\s*(${names})\\.(\\w+)`, 'g')))
      if (!CACHE_WRITE_CALL.test(lineAt(code, m.index ?? 0)))
        read.add(familyOf(`${m[1]}.${m[2]}`, familySuffix));
    for (const m of code.matchAll(
      new RegExp(`[\\w$]+\\s*:\\s*(${names})\\b(?![\\w$]|\\s*\\.)`, 'g'),
    ))
      if (!CACHE_WRITE_CALL.test(lineAt(code, m.index ?? 0))) read.add(`${m[1]}.*`);
  }
  return read;
}

function argCountAt(code: string, open: number): number | null {
  if (code[open] !== '(') return null;
  let depth = 0;
  let count = 0;
  let argOpen = false;
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i];
    if ('([{'.includes(ch)) {
      depth += 1;
      if (depth > 1) argOpen = true;
    } else if (')]}'.includes(ch)) {
      depth -= 1;
      if (depth === 0) return count + (argOpen ? 1 : 0);
    } else if (ch === ',' && depth === 1) {
      count += 1;
      argOpen = false;
    } else if (depth >= 1 && !/\s/.test(ch)) argOpen = true;
  }
  return null;
}

export function readArgCounts(
  files: ReadonlyArray<{ code: string }>,
  objects: readonly string[],
): Map<string, Set<number>> {
  const counts = new Map<string, Set<number>>();
  const re = new RegExp(`\\bqueryKey\\s*[:=]\\s*(${alternation(objects)})\\.(\\w+)\\(`, 'g');
  for (const { code } of files) {
    for (const m of code.matchAll(re)) {
      if (CACHE_WRITE_CALL.test(lineAt(code, m.index ?? 0))) continue;
      const n = argCountAt(code, (m.index ?? 0) + m[0].length - 1);
      if (n === null) continue;
      const ref = `${m[1]}.${m[2]}`;
      counts.set(ref, (counts.get(ref) ?? new Set()).add(n));
    }
  }
  return counts;
}

export function registryTargetProblems(input: {
  registryCode: string;
  reads: ReadonlyArray<{ code: string }>;
  builders: KeyBuilders;
  familySuffix: string;
}): string[] {
  const { registryCode, reads, builders, familySuffix } = input;
  const objects = Object.keys(builders);
  const refs = [
    ...new Set([...registryCode.matchAll(keyRefPattern(objects))].map((m) => `${m[1]}.${m[2]}`)),
  ];
  const read = readKeyFamilies(reads, objects, familySuffix);
  const readKeys = [...read]
    .map((f) => sampleKey(f, builders))
    .filter((k): k is unknown[] => k !== null);
  const problems: string[] = [];
  for (const ref of refs) {
    if (read.has(familyOf(ref, familySuffix)) || read.has(`${ref.split('.')[0]}.*`)) continue;
    const key = sampleKey(ref, builders);
    if (key === null || !readKeys.some((readKey) => isPrefix(key, readKey)))
      problems.push(`${ref}: no live query reads this key`);
  }
  const counts = readArgCounts(reads, objects);
  const exactRe = new RegExp(`\\b${EXACT}\\(\\s*(${alternation(objects)})\\.(\\w+)`, 'g');
  const shaped = new Set<string>();
  for (const m of registryCode.matchAll(exactRe)) {
    const ref = `${m[1]}.${m[2]}`;
    if (shaped.has(ref)) continue;
    if (m[2] === 'all' || (m[2].endsWith(familySuffix) && m[2] !== familySuffix)) {
      shaped.add(ref);
      problems.push(
        `${ref}: an exact target on a key family (only a prefix target reaches a family)`,
      );
      continue;
    }
    const n = argCountAt(registryCode, (m.index ?? 0) + m[0].length);
    const readCounts = counts.get(ref);
    if (n !== null && readCounts && !readCounts.has(n)) {
      shaped.add(ref);
      problems.push(
        `${ref}: an exact target built with ${n} argument(s), which no live read builds`,
      );
    }
  }
  const infinite = infiniteKeyFamilies(reads, objects, familySuffix);
  for (const ref of refs)
    if (reachesInfinite(ref, infinite, builders, familySuffix))
      problems.push(`${ref}: reaches an infinite list`);
  return problems;
}

function registryProblem(value: unknown, problems: string[]): void {
  const facts = value as RegistryFacts | undefined;
  if (!facts || typeof facts !== 'object') problems.push('registry is missing');
  else pathProblem(facts.path, 'registry.path', problems);
}

const cacheInvalidationProblems = (facts: CacheInvalidationFacts) => {
  const problems: string[] = [];
  registryProblem(facts?.registry, problems);
  keyModuleProblem(facts?.keyModule, problems);
  pathListProblem(facts?.readTrees, 'readTrees', problems);
  identifierProblem(facts?.familySuffix, 'familySuffix', problems);
  return problems;
};

const cacheInvalidationGuards = (facts: CacheInvalidationFacts, owned: OwnedElsewhere): Guard[] => [
  {
    title: 'saved reads are refreshed, removed, or reset only through the domain-event registry',
    description:
      `${facts.registry.path} — the object it hands to query-core's ${REGISTRY_FACTORY} — is the one place that turns something that ` +
      'happened into what the cache does: refresh, remove, or reset. No other file calls invalidateQueries, removeQueries, or ' +
      'resetQueries: emit the domain event instead, and patch an infinite list in place. The only other owners are the session-' +
      `retirement owner (${owned.sessionOwner}) and a person's own refresh, declared once beside the list-reload rule.`,
    run(context) {
      const { file: registry, findings } = requiredFile(
        context,
        facts.registry.path,
        'the domain-event registry',
      );
      if (registry && !registryObjectCode(registry))
        findings.push({
          file: registry.path,
          detail: `no registry object handed to ${REGISTRY_FACTORY}`,
        });
      const refreshes = new Set(owned.memberRefreshes.map((r) => `${r.path} ${r.call}`));
      for (const file of context.files(APP_CODE)) {
        if (file.path === facts.registry.path || file.path === owned.sessionOwner) continue;
        for (const { index, call } of clearCalls(file)) {
          if (refreshes.has(`${file.path} ${call}`)) continue;
          findings.push({
            file: file.path,
            line: file.lineOf(index),
            detail: `outside the registry: ${call.slice(0, 120)}`,
          });
        }
      }
      return findings;
    },
  },
  {
    title: 'every registry cache target is a key a live query reads, and never an infinite list',
    description:
      `Every key the registry in ${facts.registry.path} writes is reached by a live query's key (a queryKey built from the same key ` +
      `method in ${facts.readTrees.join(', ')}, or a key object handed whole to a reader); an exact target names a leaf the reads build ` +
      `with the same arguments, never a family (all, or a …${facts.familySuffix} helper); and no target reaches an infinite list — named, ` +
      'through its family helper, or through its scope. A write aimed at a key nothing reads is a silent no-op, and invalidating an ' +
      'infinite list re-runs every loaded page.',
    timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
    async run(context: GuardContext): Promise<Finding[]> {
      const { file: registry, findings } = requiredFile(
        context,
        facts.registry.path,
        'the domain-event registry',
      );
      if (!registry) return findings;
      const object = registryObjectCode(registry);
      if (!object)
        return [
          { file: registry.path, detail: `no registry object handed to ${REGISTRY_FACTORY}` },
        ];
      const builders = await loadKeyObjects(facts.keyModule);
      const { files, findings: missing } = filesUnder(context, facts.readTrees);
      findings.push(...missing);
      for (const detail of registryTargetProblems({
        registryCode: object.code,
        reads: files,
        builders,
        familySuffix: facts.familySuffix,
      })) {
        findings.push({ file: registry.path, detail });
      }
      return findings;
    },
  },
];

export interface ListResetFacts {
  keyModule: KeyModuleFacts;
  familySuffix: string;
  loadedPagesPredicate: string;
  memberRefreshes: readonly ReviewedCall[];
  refreshHandoffs: ReadonlyArray<{ hook: string; control: string; prop: string }>;
}

const RELOAD_CALL = /\b(resetQueries|refetchQueries|removeQueries)\s*\(/g;
const PATCH_CALL = /\b(setQueryData|setQueriesData)\s*(?:<[^>]*>)?\s*\(/g;
const FIRST_PAGE_TRIM =
  /\bpages\.slice\(\s*0\s*,\s*1\s*\)|\bpageParams\.slice\(\s*0\s*,\s*1\s*\)|\bpages\s*:\s*\[\s*[\w.?]+\.pages\[0\]\s*\]/;

function targetRefs(call: string, code: string, objects: readonly string[]): string[] | null {
  const names = alternation(objects);
  const direct = call.match(new RegExp(`\\bqueryKey\\s*:\\s*(${names})\\.(\\w+)`));
  if (direct) return [`${direct[1]}.${direct[2]}`];
  const indexed = call.match(/\bqueryKey\s*:\s*([A-Za-z_]\w*)\[/);
  if (!indexed) return null;
  const decl = code.match(new RegExp(`\\bconst \\s*${escapeRegExp(indexed[1])}\\b[^=]*=\\s*\\{`));
  if (!decl) return null;
  const open = (decl.index ?? 0) + decl[0].length - 1;
  const refs = [...callSpan(code, open, open).matchAll(keyRefPattern(objects))].map(
    (m) => `${m[1]}.${m[2]}`,
  );
  return refs.length ? refs : null;
}

export function listReloads(
  files: readonly FileView[],
  builders: KeyBuilders,
  facts: Pick<ListResetFacts, 'familySuffix' | 'loadedPagesPredicate' | 'memberRefreshes'>,
  sessionOwner?: string,
) {
  const objects = Object.keys(builders);
  const infinite = infiniteKeyFamilies(files, objects, facts.familySuffix);
  const pinned = new Set(facts.memberRefreshes.map((r) => `${r.path} ${r.call}`));
  const excluded = new RegExp(`!${escapeRegExp(facts.loadedPagesPredicate)}\\(\\s*query\\s*\\)`);
  const found: Finding[] = [];
  const present = new Set<string>();
  for (const file of files) {
    if (file.path === sessionOwner) continue;
    const code = file.code;
    for (const m of code.matchAll(RELOAD_CALL)) {
      const call = collapse(callSpan(code, m.index ?? 0, (m.index ?? 0) + m[0].length - 1));
      present.add(`${file.path} ${call}`);
      if (pinned.has(`${file.path} ${call}`)) continue;
      const refs = targetRefs(call, code, objects);
      const reloads = refs
        ? refs.some((ref) => reachesInfinite(ref, infinite, builders, facts.familySuffix))
        : !excluded.test(call);
      if (reloads)
        found.push({
          file: file.path,
          line: file.lineOf(m.index ?? 0),
          detail: `${refs ? 'reloads an infinite list' : 'reloads queries its key does not name'}: ${call.slice(0, 120)}`,
        });
    }
    for (const m of code.matchAll(PATCH_CALL)) {
      const call = callSpan(code, m.index ?? 0, (m.index ?? 0) + m[0].length - 1);
      if (FIRST_PAGE_TRIM.test(call))
        found.push({
          file: file.path,
          line: file.lineOf(m.index ?? 0),
          detail: `trims a list to its first page: ${collapse(call).slice(0, 120)}`,
        });
    }
  }
  for (const r of facts.memberRefreshes)
    if (!present.has(`${r.path} ${r.call}`))
      found.push({ file: r.path, detail: `stale member refresh: ${r.call} is no longer there` });
  return { infinite, findings: found };
}

export function refreshHandoffMisuses(
  files: readonly FileView[],
  handoffs: ListResetFacts['refreshHandoffs'],
): Finding[] {
  const findings: Finding[] = [];
  for (const { hook, control, prop } of handoffs) {
    let callers = 0;
    for (const file of files) {
      for (const m of file.code.matchAll(
        new RegExp(`const\\s+(\\w+)\\s*=\\s*${escapeRegExp(hook)}\\(`, 'g'),
      )) {
        callers += 1;
        const name = m[1];
        const uses = [...file.code.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length - 1;
        const handed = [
          ...file.code.matchAll(
            new RegExp(`<${escapeRegExp(control)}[^>]*${escapeRegExp(prop)}=\\{${name}\\}`, 'g'),
          ),
        ].length;
        if (uses !== handed)
          findings.push({
            file: file.path,
            line: file.lineOf(m.index ?? 0),
            detail: `${hook}()'s refresh is used other than as <${control} ${prop}>`,
          });
      }
    }
    if (!callers)
      findings.push({ file: '(refreshHandoffs)', detail: `stale entry: nothing calls ${hook}` });
  }
  return findings;
}

const listResetProblems = (facts: ListResetFacts) => {
  const problems: string[] = [];
  keyModuleProblem(facts?.keyModule, problems);
  identifierProblem(facts?.familySuffix, 'familySuffix', problems);
  identifierProblem(facts?.loadedPagesPredicate, 'loadedPagesPredicate', problems);
  reviewedCallProblem(facts?.memberRefreshes, 'memberRefreshes', problems);
  if (!Array.isArray(facts?.refreshHandoffs))
    problems.push('refreshHandoffs is missing (declare [] when there is none)');
  else
    facts.refreshHandoffs.forEach((h, i) => {
      identifierProblem(h?.hook, `refreshHandoffs[${i}].hook`, problems);
      identifierProblem(h?.control, `refreshHandoffs[${i}].control`, problems);
      identifierProblem(h?.prop, `refreshHandoffs[${i}].prop`, problems);
    });
  return problems;
};

const listResetGuards = (facts: ListResetFacts, sessionOwner: string): Guard[] => [
  {
    title: 'an action never reloads an infinite list',
    description:
      "An action's change is placed, moved, or patched in place in an infinite list; no resetQueries / refetchQueries / removeQueries " +
      `whose key reaches one (directly, through its family helper or scope, or through a constant map of keys), none whose key cannot ` +
      `be resolved unless its predicate excludes every query holding loaded pages (!${facts.loadedPagesPredicate}(query)), and no cache ` +
      "write that trims a list to its first page. A person's own refresh is declared with its why, and a refresh hook's result is only " +
      'ever handed to its refresh control.',
    timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
    async run(context) {
      const builders = await loadKeyObjects(facts.keyModule);
      const files = context.files(APP_CODE);
      const { infinite, findings } = listReloads(files, builders, facts, sessionOwner);
      if (!infinite.size)
        findings.push({
          file: facts.keyModule.path,
          detail: 'no infinite list found in the app, so the guard checks nothing',
        });
      findings.push(...refreshHandoffMisuses(files, facts.refreshHandoffs));
      return findings;
    },
  },
];

export interface SessionRetirementFacts {
  owner: string;
  predicateRetirements: ReadonlyArray<{ trigger: string; why: string }>;
}

const WHOLE_CACHE_DROP = [
  /\bcancelQueries\(\s*\)/g,
  /\bcancelQueries\(\s*undefined\b/g,
  /\bcancelQueries\(\s*\{(?![^}]*\bqueryKey\b)/g,
  /\bget(?:Query|Mutation)Cache\(\)\s*\.clear\(/g,
  /\b\w*[cC]lient\s*\.clear\(\s*\)/g,
];

export function wholeCacheDrops(file: FileView): Array<{ index: number; text: string }> {
  return WHOLE_CACHE_DROP.flatMap((re) =>
    [...file.code.matchAll(re)].map((m) => ({ index: m.index ?? 0, text: m[0] })),
  ).sort((a, b) => a.index - b.index);
}

const sessionRetirementPart = {
  factProblems(facts: SessionRetirementFacts) {
    const problems: string[] = [];
    pathProblem(facts?.owner, 'owner', problems);
    reviewedProblems(facts?.predicateRetirements, 'predicateRetirements', problems, {
      key: 'trigger',
    });
    return problems;
  },
  build: (facts: SessionRetirementFacts): Guard[] => [
    {
      title: 'an unscoped cancel or a whole-cache clear runs only in the session-retirement owner',
      description:
        `A cancelQueries with no key (bare, or selected by a predicate) and a query or mutation cache clear drop reads the call site ` +
        `cannot name, so only ${facts.owner} runs them: when a session ends it cancels every query and clears the query cache` +
        (facts.predicateRetirements.length
          ? `, and it cancels by predicate for ${facts.predicateRetirements.map((r) => r.trigger).join('; ')}`
          : '') +
        '. Everywhere else a cancel names its key, and nothing clears a cache.',
      run(context) {
        const { file: owner, findings } = requiredFile(
          context,
          facts.owner,
          'the session-retirement owner',
        );
        for (const file of context.files(APP_CODE)) {
          if (file.path === facts.owner) continue;
          for (const drop of wholeCacheDrops(file))
            findings.push({
              file: file.path,
              line: file.lineOf(drop.index),
              detail: `outside the session-retirement owner: ${drop.text}`,
            });
        }
        if (owner) {
          if (!/\bcancelQueries\(\s*\)/.test(owner.code))
            findings.push({
              file: owner.path,
              detail: 'the owner no longer cancels every query when a session ends',
            });
          if (!/getQueryCache\(\)\s*\.clear\(/.test(owner.code))
            findings.push({
              file: owner.path,
              detail: 'the owner no longer clears the query cache when a session ends',
            });
          const byPredicate = [...owner.code.matchAll(/\bcancelQueries\(\s*\{\s*predicate\s*:/g)]
            .length;
          if (byPredicate !== facts.predicateRetirements.length) {
            findings.push({
              file: owner.path,
              detail: `the owner cancels by predicate ${byPredicate} time(s); ${facts.predicateRetirements.length} predicate retirement(s) are reviewed`,
            });
          }
        }
        return findings;
      },
    },
  ],
};

export interface DomainEventRegistryFacts {
  registry: RegistryFacts & {
    load: Loader<Record<string, unknown>>;
  };
  eventSchema: Loader<unknown>;
  notifiers: readonly string[];
}

type ZodDef = { type?: unknown; innerType?: ZodLike };
type ZodLike = {
  def?: ZodDef;
  _def?: ZodDef;
  shape?: Record<string, ZodLike>;
  options?: unknown[];
  value?: unknown;
};
const defOf = (field: ZodLike): ZodDef => field?.def ?? field?._def ?? {};
const kindOf = (field: ZodLike): 'optional' | 'nullable' | 'enum' | 'required' => {
  const type = defOf(field).type;
  return type === 'optional' || type === 'nullable' || type === 'enum' ? type : 'required';
};

export function syntheticIds(idsSchema: ZodLike): Array<Record<string, unknown>> {
  const baseline: Record<string, unknown> = {};
  const optional: string[] = [];
  for (const [key, field] of Object.entries(idsSchema?.shape ?? {})) {
    const kind = kindOf(field);
    if (kind === 'enum') baseline[key] = (field.options as unknown[])[0];
    else if (kind === 'optional') {
      optional.push(key);
      const inner = defOf(field).innerType as ZodLike;
      baseline[key] = kindOf(inner) === 'enum' ? (inner.options as unknown[])[0] : `test-${key}`;
    } else baseline[key] = `test-${key}`;
  }
  return [
    { ...baseline },
    ...optional.map((key) =>
      Object.fromEntries(Object.entries(baseline).filter(([k]) => k !== key)),
    ),
  ];
}

const CACHE_ACTIONS: ReadonlySet<unknown> = new Set([undefined, 'refresh', 'remove', 'reset']);
const REFETCH_TYPES: ReadonlySet<unknown> = new Set([undefined, 'active', 'all', 'none']);

export function malformedInvalidations(answer: unknown): string | null {
  if (!Array.isArray(answer)) return 'does not answer a list of invalidations';
  for (const inv of answer as Array<Record<string, unknown>>) {
    if (inv?.kind === 'exact' || inv?.kind === 'prefix') {
      if (!Array.isArray(inv.queryKey) || !inv.queryKey.length)
        return `a ${inv.kind} invalidation with no key`;
    } else if (inv?.kind === 'predicate') {
      if (
        typeof inv.description !== 'string' ||
        !inv.description ||
        typeof inv.match !== 'function'
      )
        return 'a predicate invalidation with no description or matcher';
    } else return `an invalidation of unknown kind ${String(inv?.kind)}`;
    if (!CACHE_ACTIONS.has(inv.action))
      return `a ${inv.kind} invalidation with unknown action ${String(inv.action)}`;
    if (!REFETCH_TYPES.has(inv.refetchType))
      return `a ${inv.kind} invalidation with unknown refetchType ${String(inv.refetchType)}`;
    if ((inv.action === 'remove' || inv.action === 'reset') && inv.refetchType !== undefined) {
      return `a ${inv.action} invalidation with a refetchType, which only a refresh takes`;
    }
  }
  return null;
}

function startsStatement(code: string, index: number): boolean {
  const before = code.slice(0, index).trimEnd();
  return before.length === 0 || ';{})'.includes(before.charAt(before.length - 1));
}

export function droppedNotifications(
  file: FileView,
  notifiers: readonly string[],
): Array<{ index: number; name: string }> {
  const hits: Array<{ index: number; name: string }> = [];
  for (const m of file.code.matchAll(new RegExp(`\\b(${alternation(notifiers)})\\(`, 'g'))) {
    const index = m.index ?? 0;
    if (/function\s+$/.test(file.code.slice(0, index))) continue;
    if (startsStatement(file.code, index)) hits.push({ index, name: m[1] });
  }
  return hits;
}

export const domainEventRegistryGuard: GenericGuardDefinition<DomainEventRegistryFacts> = {
  id: 'domainEventRegistry',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    registryProblem(facts?.registry, problems);
    loaderProblem(facts?.registry?.load, 'registry.load', problems);
    loaderProblem(facts?.eventSchema, 'eventSchema', problems);
    identifierListProblem(facts?.notifiers, 'notifiers', problems, { nonEmpty: true });
    return problems;
  },
  build: (facts) => [
    {
      title: 'every registered domain event has a producer in the app',
      description:
        `Every event type the registry in ${facts.registry.path} handles is emitted somewhere in the app's own code (its quoted type ` +
        "outside the registry, in the client or functions tree); the core's schema holds every variant by construction, so it is no " +
        'evidence. Restore the producer, or delete the event from the core and the registry.',
      async run(context) {
        const registry = (await facts.registry.load()) ?? {};
        const findings: Finding[] = [];
        const haystack = context
          .files({
            roots: ['app', 'functions'],
            optionalRoots: ['functions'],
            kinds: ['code'],
            tests: false,
          })
          .filter((f) => f.path !== facts.registry.path)
          .map((f) => f.code)
          .join('\n');
        const produced = (type: string) =>
          haystack.includes(`'${type}'`) || haystack.includes(`"${type}"`);
        for (const type of Object.keys(registry))
          if (!produced(type))
            findings.push({ file: facts.registry.path, detail: `${type}: no producer in the app` });
        return findings;
      },
    },
    {
      title: 'every core domain-event variant has a registry entry with well-formed invalidations',
      description:
        `Every variant of the core's domain-event schema has an entry in the registry in ${facts.registry.path}, and the entry answers, ` +
        'for every shape of its ids (each optional id present and absent), a list of invalidations that are each an exact or prefix ' +
        'target with a non-empty key, or a predicate with a description and a matcher.',
      async run(context) {
        if (!context.reader.exists(facts.registry.path))
          return [{ file: facts.registry.path, detail: 'the registry file does not exist' }];
        context.file(facts.registry.path);
        const registry = (await facts.registry.load()) ?? {};
        const schema = (await facts.eventSchema()) as ZodLike;
        const variants = (schema?.options ?? []) as ZodLike[];
        if (!variants.length)
          return [
            {
              file: '(eventSchema)',
              detail: 'the loader did not answer a discriminated union of variants',
            },
          ];
        const findings: Finding[] = [];
        for (const variant of variants) {
          const type = String(variant.shape?.type?.value ?? '');
          if (!type) {
            findings.push({ file: '(eventSchema)', detail: 'a variant carries no literal type' });
            continue;
          }
          const build = registry[type];
          if (typeof build !== 'function') {
            findings.push({ file: facts.registry.path, detail: `${type}: no registry entry` });
            continue;
          }
          for (const ids of syntheticIds(variant.shape?.ids as ZodLike)) {
            let problem: string | null;
            try {
              problem = malformedInvalidations((build as (ids: unknown) => unknown)(ids));
            } catch (err) {
              problem = `throws for ids ${JSON.stringify(ids)}: ${(err as Error)?.message ?? err}`;
            }
            if (problem)
              findings.push({ file: facts.registry.path, detail: `${type}: ${problem}` });
          }
        }
        return findings;
      },
    },
    {
      title: 'every domain-event notification hands its refresh promise on',
      description:
        `A call to ${facts.notifiers.join(' / ')} returns the promise of the refresh it starts; a mutation returns or awaits it so it stays ` +
        'pending until the refreshed data is on screen. A call in statement position drops it silently: return it, await it, pass it ' +
        'on, or mark a deliberate fire-and-forget with void.',
      run(context) {
        const findings: Finding[] = [];
        let calls = 0;
        const callRe = new RegExp(`\\b(?:${alternation(facts.notifiers)})\\(`, 'g');
        for (const file of context.files(APP_CODE)) {
          calls += [...file.code.matchAll(callRe)].length;
          for (const hit of droppedNotifications(file, facts.notifiers)) {
            findings.push({
              file: file.path,
              line: file.lineOf(hit.index),
              detail: `${hit.name}(…) in statement position drops its refresh`,
            });
          }
        }
        if (!calls)
          findings.push({
            file: '(notifiers)',
            detail: `nothing in the app calls ${facts.notifiers.join(' / ')}, so the guard checks nothing`,
          });
        return findings;
      },
    },
  ],
};

export interface QueryCacheFacts extends CacheInvalidationFacts {
  loadedPagesPredicate: string;
  memberRefreshes: readonly ReviewedCall[];
  refreshHandoffs: ListResetFacts['refreshHandoffs'];
  sessionOwner: string;
  predicateRetirements: SessionRetirementFacts['predicateRetirements'];
}

const listFacts = (f: QueryCacheFacts | undefined): ListResetFacts => ({
  keyModule: f?.keyModule as KeyModuleFacts,
  familySuffix: f?.familySuffix as string,
  loadedPagesPredicate: f?.loadedPagesPredicate as string,
  memberRefreshes: f?.memberRefreshes as readonly ReviewedCall[],
  refreshHandoffs: f?.refreshHandoffs as ListResetFacts['refreshHandoffs'],
});

export const queryCacheGuard: GenericGuardDefinition<QueryCacheFacts> = {
  id: 'queryCache',
  absentWhen: false,
  factProblems: (f) => [
    ...new Set([
      ...cacheInvalidationProblems(f),
      ...listResetProblems(listFacts(f)),
      ...sessionRetirementPart
        .factProblems({ owner: f?.sessionOwner, predicateRetirements: f?.predicateRetirements })
        .map((p) => (p.startsWith('owner') ? `session${p[0].toUpperCase()}${p.slice(1)}` : p)),
    ]),
  ],
  build: (f) => [
    ...cacheInvalidationGuards(f, {
      sessionOwner: f.sessionOwner,
      memberRefreshes: f.memberRefreshes,
    }),
    ...listResetGuards(listFacts(f), f.sessionOwner),
    ...sessionRetirementPart.build({
      owner: f.sessionOwner,
      predicateRetirements: f.predicateRetirements,
    }),
  ],
};

export const CACHE_GUARDS = [queryCacheGuard, domainEventRegistryGuard] as const;
