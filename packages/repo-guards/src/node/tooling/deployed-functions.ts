// What `firebase deploy` reports is not proof of what is live: the CLI can exit 0 after a
// function's create failed — it drops that function and still runs the deletions — so a green
// deploy can ship without a function the build declares. This check reads the project itself: for
// each codebase the deploy targeted, the live functions must be exactly the expected ones, each
// ACTIVE.
//   - missing:   expected, not live (a create the deploy dropped or failed)
//   - leftover:  live, no longer expected (a deletion that did not happen)
//   - notActive: live but not ACTIVE (a deploy left it FAILED or still deploying)

/** The label carrying a function's codebase. */
export const CODEBASE_LABEL = 'firebase-functions-codebase';

/**
 * One codebase's expected functions. `codebase: null` is an app that deploys one unnamed codebase:
 * every function live in the region is its.
 */
export interface ExpectedCodebase {
  codebase: string | null;
  names: readonly string[];
}

export interface LiveFunction {
  name: string;
  codebase: string | null;
  state: string;
}

/** The live functions from `gcloud functions list --format=json` rows. */
export function parseLiveFunctions(
  rows: readonly { name?: string; state?: string; labels?: Record<string, string> }[],
): LiveFunction[] {
  return rows.map((row) => ({
    name: String(row.name ?? '')
      .split('/')
      .pop()!,
    codebase: row.labels?.[CODEBASE_LABEL] ?? null,
    state: row.state ?? 'UNKNOWN',
  }));
}

/**
 * The codebases a `firebase deploy --only` functions selection deploys: `functions` (every
 * codebase), `functions:a,functions:b`, or `none`. Throws on a selection it cannot read, so a
 * malformed value fails the job instead of checking nothing.
 */
export function targetedCodebases(targets: unknown, allCodebases: readonly string[]): string[] {
  const value = String(targets ?? '').trim();
  if (value === 'none') return [];
  if (value === 'functions') return [...allCodebases];
  const parts = value.split(',').map((part) => part.trim());
  const selected = parts.map((part) => {
    const match = /^functions:([a-z][a-z0-9-]*)$/.exec(part);
    if (!match || !allCodebases.includes(match[1]!)) {
      throw new Error(`Unreadable functions selection "${value}" (part "${part}").`);
    }
    return match[1]!;
  });
  return [...new Set(selected)];
}

/**
 * Compare the expected functions with the live ones. Every live function is checked, whatever
 * deployed it: one the release did not put there is still a function the project serves.
 */
export function compareDeployedFunctions(
  expected: readonly ExpectedCodebase[],
  live: readonly LiveFunction[],
): { missing: string[]; leftover: string[]; notActive: string[] } {
  const missing: string[] = [];
  const leftover: string[] = [];
  const notActive: string[] = [];
  for (const group of expected) {
    const label = (name: string): string => (group.codebase ? `${group.codebase}:${name}` : name);
    const wanted = new Set(group.names);
    const liveHere = live.filter((fn) => group.codebase === null || fn.codebase === group.codebase);
    const liveNames = new Set(liveHere.map((fn) => fn.name));
    for (const name of wanted) if (!liveNames.has(name)) missing.push(label(name));
    for (const fn of liveHere) {
      if (!wanted.has(fn.name)) leftover.push(label(fn.name));
      else if (fn.state !== 'ACTIVE') notActive.push(`${label(fn.name)} (${fn.state})`);
    }
  }
  return { missing: missing.sort(), leftover: leftover.sort(), notActive: notActive.sort() };
}
