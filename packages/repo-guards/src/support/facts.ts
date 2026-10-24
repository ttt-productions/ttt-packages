export type Loader<T> = () => T | Promise<T>;

// Array.isArray narrows to any[], which drops the element type a facts list declares.
export const isList = <T>(
  value: T,
): value is unknown extends T ? T & readonly unknown[] : Extract<T, readonly unknown[]> =>
  Array.isArray(value);

export const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function textProblem(value: unknown, what: string, problems: string[]): void {
  if (!isText(value)) problems.push(`${what} is missing`);
}

export function identifierProblem(value: unknown, what: string, problems: string[]): void {
  if (typeof value !== 'string' || !IDENTIFIER.test(value))
    problems.push(`${what} must be an identifier`);
}

export function objectProblem(
  value: unknown,
  what: string,
  problems: string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    problems.push(`${what} is missing`);
    return false;
  }
  return true;
}

export function importAliasesProblem(value: unknown, what: string, problems: string[]): void {
  if (!objectProblem(value, what, problems)) return;
  for (const [prefix, folder] of Object.entries(value))
    if (!prefix || !isText(folder)) problems.push(`${what} ${prefix} needs a target folder`);
}

export function loaderProblem(value: unknown, what: string, problems: string[]): void {
  if (typeof value !== 'function') problems.push(`${what} needs a loader function`);
}

export function loaderListProblem(
  value: unknown,
  what: string,
  key: string,
  loaders: readonly string[],
  problems: string[],
): void {
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
    for (const field of loaders)
      loaderProblem(entry[field], `${what} entry ${name}'s ${field}`, problems);
  }
}

export const takesNoFacts = (value: unknown): string[] =>
  value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length
    ? []
    : ['this guard takes no facts: declare it with {}'];

export function listProblem(
  value: unknown,
  what: string,
  problems: string[],
  { nonEmpty = true }: { nonEmpty?: boolean } = {},
): void {
  if (!Array.isArray(value)) problems.push(missing(what, nonEmpty));
  else if (nonEmpty && !value.length) problems.push(`${what} is empty`);
}

const missing = (what: string, nonEmpty: boolean) =>
  `${what} is missing${nonEmpty ? '' : ' (declare [] when there is none)'}`;

export function pathProblem(value: unknown, what: string, problems: string[]): void {
  if (!isText(value)) problems.push(`${what} is missing`);
  else if (value.startsWith('/') || value.includes('\\') || /^[A-Za-z]:/.test(value))
    problems.push(`${what} (${value}) must be repo-relative and forward-slashed`);
  else if (value.endsWith('/')) problems.push(`${what} (${value}) must not end with a slash`);
}

export function namesProblem(
  value: unknown,
  what: string,
  problems: string[],
  { nonEmpty = true }: { nonEmpty?: boolean } = {},
): void {
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
  key?: string;
  id?: (entry: Record<string, unknown>) => string | undefined;
  idNames?: string;
  nonEmpty?: boolean;
  extra?: (entry: Record<string, unknown>, label: string) => void;
}

export function reviewedProblems(
  value: unknown,
  what: string,
  problems: string[],
  { key = 'path', id, idNames = 'its site', nonEmpty = false, extra }: ReviewedListOptions = {},
): void {
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

export function allowlistProblems(
  value: unknown,
  what: string,
  problems: string[],
  { countRequired = false }: { countRequired?: boolean } = {},
): void {
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
