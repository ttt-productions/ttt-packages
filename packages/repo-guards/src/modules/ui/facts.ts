// Checking the facts an app hands the UI guards. Every check names the fact and what is wrong
// with it; a missing fact is a problem, never a default.

import { isText, pathProblem } from '../../support/facts.js';

/** A path, or an explicit null meaning the app has no such file. */
export function requirePathOrNull(value: unknown, what: string, problems: string[]) {
  if (value === null) return;
  if (!isText(value)) problems.push(`${what} is missing (declare null when the app has none)`);
  else pathProblem(value, what, problems);
}
