// The three shapes an app builds its business guards on. Each takes the app's matcher and facts and
// returns a guard the suite runs exactly like a generic one. A shape validates its facts when it is
// built, so a malformed business guard fails the config, never passes quietly.
//
//   owner-only         a pattern appears only in its owner files, and every owner still holds it
//   reviewed allowlist a pattern appears only in reviewed files, each with its why; an entry that
//                      no longer matches is stale
//   declared literal   declared values are banned, owned by their declaring files, or each covered

import type { Finding, Guard, GuardContext, Sample } from '../guard.js';
import type { Scope } from '../reader/reader.js';
import { viewOfText, type FileView } from '../reader/view.js';

/** One match inside a file: where it starts (an index into `text`/`code`) and what it is. */
export interface Hit {
  index: number;
  detail?: string;
}

/** Finds a guard's pattern in one file. Reading `file.code` keeps comments out of the match. */
export type Matcher = (file: FileView) => readonly Hit[];

interface ShapeBase {
  title: string;
  description: string;
  scope: Scope;
  /** Must-fail and must-pass inputs for the matcher (required: a shape proves its matcher). */
  samples: { flags: readonly Sample[]; passes: readonly Sample[] };
  timeoutMs?: number;
}

/** Every match of a regular expression in a file's comment-stripped code. */
export function matchPattern(pattern: RegExp, detail?: (match: RegExpExecArray) => string): Matcher {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return (file) => {
    const re = new RegExp(pattern.source, flags);
    const hits: Hit[] = [];
    for (let m = re.exec(file.code); m; m = re.exec(file.code)) {
      hits.push({ index: m.index, detail: detail ? detail(m) : m[0].trim().slice(0, 120) });
      if (m[0] === '') re.lastIndex += 1;
    }
    return hits;
  };
}

function requireText(value: unknown, what: string, problems: string[]) {
  if (typeof value !== 'string' || !value.trim()) problems.push(`${what} is empty`);
}

function baseProblems(shape: ShapeBase, problems: string[]) {
  requireText(shape.title, 'the title', problems);
  requireText(shape.description, `${shape.title}: the description`, problems);
  if (!shape.scope?.roots?.length || !shape.scope?.kinds?.length) problems.push(`${shape.title}: the scope names no root or kind`);
  if (!shape.samples?.flags?.length) problems.push(`${shape.title}: no must-fail sample — a matcher that catches nothing passes everything`);
  if (!shape.samples?.passes?.length) problems.push(`${shape.title}: no must-pass sample`);
}

function fail(title: string, problems: string[]): never {
  throw new Error(`repo-guards: the business guard "${title}" is malformed:\n  - ${problems.join('\n  - ')}`);
}

const toView = (sample: Sample) =>
  typeof sample === 'string' ? viewOfText('sample.ts', sample) : viewOfText(sample.path, sample.text);

function withSamples(shape: ShapeBase, matcher: Matcher, run: Guard['run']): Guard {
  return {
    title: shape.title,
    description: shape.description,
    timeoutMs: shape.timeoutMs,
    run,
    samples: {
      flags: shape.samples.flags,
      passes: shape.samples.passes,
      probe: (view) => matcher(view),
    },
  };
}

const findingsAt = (file: FileView, hits: readonly Hit[], prefix: string): Finding[] =>
  hits.map((hit) => ({ file: file.path, line: file.lineOf(hit.index), detail: `${prefix}${hit.detail ?? ''}`.trim() }));

/**
 * Owner-only: the pattern may appear only in the owner files. An owner the pattern no longer
 * appears in is stale — the owner moved, and the entry would otherwise license whatever lands there.
 */
export function ownerOnly(shape: ShapeBase & { match: Matcher; owners: readonly string[] }): Guard {
  const problems: string[] = [];
  baseProblems(shape, problems);
  if (typeof shape.match !== 'function') problems.push(`${shape.title}: no matcher`);
  if (!shape.owners?.length) problems.push(`${shape.title}: names no owner file`);
  if (new Set(shape.owners).size !== shape.owners?.length) problems.push(`${shape.title}: an owner is listed twice`);
  if (problems.length) fail(shape.title, problems);
  const owners = new Set(shape.owners);
  return withSamples(shape, shape.match, (context: GuardContext) => {
    const findings: Finding[] = [];
    const held = new Set<string>();
    for (const file of context.files(shape.scope)) {
      const hits = shape.match(file);
      if (!hits.length) continue;
      if (owners.has(file.path)) held.add(file.path);
      else findings.push(...findingsAt(file, hits, 'outside its owner: '));
    }
    for (const owner of owners) {
      if (!context.reader.exists(owner)) findings.push({ file: owner, detail: 'the owner file no longer exists' });
      else if (!held.has(owner)) findings.push({ file: owner, detail: 'stale owner: the pattern no longer appears in it (or it is outside the scope)' });
    }
    return findings;
  });
}

/** One reviewed file: why it may hold the pattern, and optionally exactly how many times. */
export interface AllowlistEntry {
  path: string;
  why: string;
  count?: number;
}

/**
 * Reviewed allowlist: the pattern may appear only in reviewed files. An entry whose file no longer
 * holds the pattern (or holds it a different number of times than reviewed) is stale.
 */
export function reviewedAllowlist(shape: ShapeBase & { match: Matcher; allowlist: readonly AllowlistEntry[] }): Guard {
  const problems: string[] = [];
  baseProblems(shape, problems);
  if (typeof shape.match !== 'function') problems.push(`${shape.title}: no matcher`);
  const seen = new Set<string>();
  for (const entry of shape.allowlist ?? []) {
    if (!entry?.path) problems.push(`${shape.title}: an allowlist entry names no file`);
    else {
      if (seen.has(entry.path)) problems.push(`${shape.title}: ${entry.path} is listed twice`);
      seen.add(entry.path);
      requireText(entry.why, `${shape.title}: ${entry.path}'s why`, problems);
      if (entry.count !== undefined && !(Number.isInteger(entry.count) && entry.count > 0)) {
        problems.push(`${shape.title}: ${entry.path}'s count must be a positive whole number`);
      }
    }
  }
  if (problems.length) fail(shape.title, problems);
  const entries = new Map(shape.allowlist.map((e) => [e.path, e]));
  return withSamples(shape, shape.match, (context) => {
    const findings: Finding[] = [];
    const counts = new Map<string, number>();
    for (const file of context.files(shape.scope)) {
      const hits = shape.match(file);
      if (!hits.length) continue;
      const entry = entries.get(file.path);
      if (!entry) findings.push(...findingsAt(file, hits, 'not on the reviewed list: '));
      else {
        counts.set(file.path, hits.length);
        if (entry.count !== undefined && hits.length > entry.count) {
          findings.push(...findingsAt(file, hits.slice(entry.count), `more than the ${entry.count} reviewed: `));
        }
      }
    }
    for (const entry of shape.allowlist) {
      const found = counts.get(entry.path) ?? 0;
      if (!found) findings.push({ file: entry.path, detail: 'stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)' });
      else if (entry.count !== undefined && found < entry.count) {
        findings.push({ file: entry.path, detail: `stale count: reviewed ${entry.count}, found ${found}` });
      }
    }
    return findings;
  });
}

/** A declared value: a string matched as written, or a pattern. */
export type Literal = string | RegExp;

/**
 * Declared literal. The values come from the app (often read from its core package at run time):
 *   - `banned`:   no value appears anywhere in the scope;
 *   - `owned`:    values appear only in the owner files, and every owner still holds one;
 *   - `covered`:  every value appears somewhere in the scope.
 * An empty value list is a vacuous guard and fails.
 */
export function declaredLiteral(
  shape: ShapeBase & {
    literals: readonly Literal[] | (() => readonly Literal[] | Promise<readonly Literal[]>);
    mode: 'banned' | 'owned' | 'covered';
    owners?: readonly string[];
  },
): Guard {
  const problems: string[] = [];
  baseProblems(shape, problems);
  if (!['banned', 'owned', 'covered'].includes(shape.mode)) problems.push(`${shape.title}: unknown mode ${String(shape.mode)}`);
  if (shape.mode === 'owned' && !shape.owners?.length) problems.push(`${shape.title}: an owned literal names no owner file`);
  if (shape.mode !== 'owned' && shape.owners?.length) problems.push(`${shape.title}: owners apply only to the owned mode`);
  if (!Array.isArray(shape.literals) && typeof shape.literals !== 'function') problems.push(`${shape.title}: no declared values`);
  if (problems.length) fail(shape.title, problems);

  const matcherFor = (literals: readonly Literal[]): Matcher => (file) => {
    const hits: Hit[] = [];
    for (const literal of literals) {
      if (typeof literal === 'string') {
        for (let i = file.code.indexOf(literal); i !== -1; i = file.code.indexOf(literal, i + literal.length)) {
          hits.push({ index: i, detail: literal });
        }
      } else hits.push(...matchPattern(literal)(file));
    }
    return hits.sort((a, b) => a.index - b.index);
  };
  const load = async () => {
    const literals = typeof shape.literals === 'function' ? await shape.literals() : shape.literals;
    if (!literals.length) throw new Error(`${shape.title}: the declared value list is empty, so the guard checks nothing`);
    for (const l of literals) if (l === '' || (typeof l !== 'string' && !(l instanceof RegExp))) throw new Error(`${shape.title}: a declared value is empty or not a string or pattern`);
    return literals;
  };

  let loaded: readonly Literal[] | null = null;
  const literalsOrThrow = () => {
    if (!loaded) throw new Error(`${shape.title}: the declared values were never loaded`);
    return loaded;
  };
  const guard = withSamples(shape, (file) => matcherFor(literalsOrThrow())(file), (context) => {
    const literals = literalsOrThrow();
    const match = matcherFor(literals);
    const findings: Finding[] = [];
    const owners = new Set(shape.owners ?? []);
    const held = new Set<string>();
    const covered = new Set<Literal>();
    for (const file of context.files(shape.scope)) {
      const hits = match(file);
      if (!hits.length) continue;
      if (shape.mode === 'covered') {
        for (const literal of literals) if (matcherFor([literal])(file).length) covered.add(literal);
      } else if (shape.mode === 'owned' && owners.has(file.path)) held.add(file.path);
      else findings.push(...findingsAt(file, hits, shape.mode === 'banned' ? 'banned: ' : 'restated outside its owner: '));
    }
    if (shape.mode === 'covered') {
      for (const literal of literals) if (!covered.has(literal)) findings.push({ file: '(declared values)', detail: `nothing in the scope covers ${String(literal)}` });
    }
    for (const owner of owners) {
      if (!held.has(owner)) findings.push({ file: owner, detail: 'stale owner: no declared value appears in it (or it is outside the scope)' });
    }
    return findings;
  });
  return {
    ...guard,
    async prepare() {
      loaded = await load();
    },
  };
}

/** True when a sample hits the guard's matcher. Exposed so the suite and package tests agree. */
export function sampleHits(guard: Guard, sample: Sample): number {
  if (!guard.samples) throw new Error(`${guard.title}: carries no samples`);
  return guard.samples.probe(toView(sample)).length;
}
