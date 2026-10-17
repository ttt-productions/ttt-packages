// Checks on the facts an app supplies, shared by every guard area: one wording and one rule set.
// Every check pushes its problems, in words, onto `problems`; none pushes means the fact is usable.
// Internal to the package: no public entry exports them.

/** A value an app reads from its own code at run time (often its core package), loaded inside the guard. */
export type Loader<T> = () => T | Promise<T>;

/** A string with something in it. */
export const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A required text fact: a string with something in it. */
export function textProblem(value: unknown, what: string, problems: string[]): void {
  if (!isText(value)) problems.push(`${what} is missing`);
}

/** A name code declares or reads: an identifier. */
export function identifierProblem(value: unknown, what: string, problems: string[]): void {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) problems.push(`${what} must be an identifier`);
}

/** A required object fact. True when it is one, so its fields can be checked next. */
export function objectProblem(value: unknown, what: string, problems: string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    problems.push(`${what} is missing`);
    return false;
  }
  return true;
}

/** A loader the app writes (`() => import(...)`), so the package never imports app code itself. */
export function loaderProblem(value: unknown, what: string, problems: string[]): void {
  if (typeof value !== 'function') problems.push(`${what} needs a loader function`);
}

/**
 * Entries each named under `key` (none twice) whose `loaders` fields are each a loader: what a rules
 * mirror reads from the core for each name.
 */
export function loaderListProblem(value: unknown, what: string, key: string, loaders: readonly string[], problems: string[]): void {
  if (!Array.isArray(value)) {
    problems.push(missing(what, false));
    return;
  }
  const seen = new Set<string>();
  for (const raw of value as unknown[]) {
    const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = entry[key];
    if (!isText(name)) {
      problems.push(`an entry of ${what} names no ${key}`);
      continue;
    }
    if (seen.has(name)) problems.push(`${what} lists ${name} twice`);
    seen.add(name);
    for (const field of loaders) loaderProblem(entry[field], `${what} entry ${name}'s ${field}`, problems);
  }
}

/** The fact check of a guard that takes no facts: it is declared with `{}`. */
export const takesNoFacts = (value: unknown): string[] =>
  value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length ? [] : ['this guard takes no facts: declare it with {}'];

/** A list fact whose entries another check reads: present, and non-empty unless `nonEmpty` is false. */
export function listProblem(value: unknown, what: string, problems: string[], { nonEmpty = true }: { nonEmpty?: boolean } = {}): void {
  if (!Array.isArray(value)) problems.push(missing(what, nonEmpty));
  else if (nonEmpty && !value.length) problems.push(`${what} is empty`);
}

/** A missing list: a required one is just missing; one an app may have none of is declared `[]`. */
const missing = (what: string, nonEmpty: boolean) => `${what} is missing${nonEmpty ? '' : ' (declare [] when there is none)'}`;

/** A repo-relative, forward-slashed path with no trailing slash. */
export function pathProblem(value: unknown, what: string, problems: string[]): void {
  if (!isText(value)) problems.push(`${what} is missing`);
  else if (value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value)) problems.push(`${what} (${value}) must be repo-relative and forward-slashed`);
  else if (value.endsWith('/')) problems.push(`${what} (${value}) must not end with a slash`);
}

/** A list of names: present, non-empty unless `nonEmpty` is false, every entry text, none twice. */
export function namesProblem(value: unknown, what: string, problems: string[], { nonEmpty = true }: { nonEmpty?: boolean } = {}): void {
  if (!Array.isArray(value)) {
    problems.push(missing(what, nonEmpty));
    return;
  }
  if (nonEmpty && !value.length) problems.push(`${what} is empty`);
  const seen = new Set<string>();
  for (const name of value) {
    if (!isText(name)) problems.push(`${what} holds an empty entry`);
    else if (seen.has(name)) problems.push(`${what} lists ${name} twice`);
    else seen.add(name);
  }
}

export interface ReviewedListOptions {
  /** The field that names what an entry is about (`path` by default); a `path` is checked as a path. */
  key?: string;
  /** What an entry is told apart by, when that is more than its key (a file and the site in it). */
  id?: (entry: Record<string, unknown>) => string | undefined;
  /** What `id` needs beyond the key, as a problem names it when it is missing (`function`). */
  idNames?: string;
  /** The list may not be empty. */
  nonEmpty?: boolean;
  /** Checks an entry's other fields; `label` is `<what> entry <id>`. */
  extra?: (entry: Record<string, unknown>, label: string) => void;
}

/**
 * Reviewed entries: each names its subject under `key` and carries a why, and none is listed twice —
 * two entries for one subject would let one of them go stale unseen.
 */
export function reviewedProblems(value: unknown, what: string, problems: string[], { key = 'path', id, idNames = 'its site', nonEmpty = false, extra }: ReviewedListOptions = {}): void {
  if (!Array.isArray(value)) {
    problems.push(missing(what, nonEmpty));
    return;
  }
  if (nonEmpty && !value.length) problems.push(`${what} is empty`);
  const seen = new Set<string>();
  for (const raw of value as unknown[]) {
    const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const subject = entry[key];
    if (!isText(subject)) {
      problems.push(`an entry of ${what} names no ${key}`);
      continue;
    }
    const identity = id ? id(entry) : subject;
    const label = `${what} entry ${isText(identity) ? identity : subject}`;
    if (key === 'path') pathProblem(subject, label, problems);
    if (!isText(identity)) problems.push(`${label} names no ${idNames}`);
    else if (seen.has(identity)) problems.push(`${what} lists ${identity} twice`);
    else seen.add(identity);
    if (!isText(entry.why)) problems.push(`${label} carries no why`);
    extra?.(entry, label);
  }
}

/** Reviewed files a shape's allowlist takes: each with its why and, when given or required, a positive whole count. */
export function allowlistProblems(value: unknown, what: string, problems: string[], { countRequired = false }: { countRequired?: boolean } = {}): void {
  reviewedProblems(value, what, problems, {
    extra(entry, label) {
      if (entry.count === undefined) {
        if (countRequired) problems.push(`${label} needs its reviewed count`);
      } else if (!(Number.isInteger(entry.count) && (entry.count as number) > 0)) {
        problems.push(`${label}'s count must be a positive whole number`);
      }
    },
  });
}
