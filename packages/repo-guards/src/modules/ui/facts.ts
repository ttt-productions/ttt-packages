// Checking the facts an app hands the UI guards. Every check names the fact and what is wrong
// with it; a missing fact is a problem, never a default.

import type { AllowlistEntry } from '../../shapes/shapes.js';

export const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

export function requireObject(facts: unknown, problems: string[]): facts is Record<string, unknown> {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
    problems.push('the facts are missing (an object is required)');
    return false;
  }
  return true;
}

export function requirePath(value: unknown, what: string, problems: string[]) {
  if (!isText(value)) problems.push(`${what} is missing`);
}

/** A path, or an explicit null meaning the app has no such file. */
export function requirePathOrNull(value: unknown, what: string, problems: string[]) {
  if (value !== null && !isText(value)) problems.push(`${what} is missing (declare null when the app has none)`);
}

export function requireNames(value: unknown, what: string, problems: string[], { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    problems.push(`${what} is missing${nonEmpty ? '' : ' (declare [] when there is none)'}`);
    return;
  }
  if (nonEmpty && !value.length) problems.push(`${what} is empty`);
  for (const name of value) if (!isText(name)) problems.push(`${what} holds an empty or non-text entry`);
  if (new Set(value).size !== value.length) problems.push(`${what} lists an entry twice`);
}

/** Reviewed entries: each names its file and why; a count, when given, is a positive whole number. */
export function requireAllowlist(value: unknown, what: string, problems: string[], { countRequired = false } = {}) {
  if (!Array.isArray(value)) {
    problems.push(`${what} is missing (declare [] when there is none)`);
    return;
  }
  const seen = new Set<string>();
  for (const entry of value as AllowlistEntry[]) {
    if (!isText(entry?.path)) {
      problems.push(`an entry in ${what} names no file`);
      continue;
    }
    if (seen.has(entry.path)) problems.push(`${what} lists ${entry.path} twice`);
    seen.add(entry.path);
    if (!isText(entry.why)) problems.push(`${what} entry ${entry.path} carries no why`);
    if (countRequired && entry.count === undefined) problems.push(`${what} entry ${entry.path} needs its reviewed count`);
    if (entry.count !== undefined && !(Number.isInteger(entry.count) && entry.count > 0)) {
      problems.push(`${what} entry ${entry.path}'s count must be a positive whole number`);
    }
  }
}
