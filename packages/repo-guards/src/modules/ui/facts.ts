import { isText, pathProblem } from '../../support/facts.js';

export function requirePathOrNull(value: unknown, what: string, problems: string[]) {
  if (value === null) return;
  if (!isText(value)) problems.push(`${what} is missing (declare null when the app has none)`);
  else pathProblem(value, what, problems);
}
