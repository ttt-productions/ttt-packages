// `firebase deploy` can exit 0 after a function's create failed, so the live project is read instead.

export const CODEBASE_LABEL = 'firebase-functions-codebase';

export interface ExpectedCodebase {
  codebase: string | null;
  names: readonly string[];
}

export interface LiveFunction {
  name: string;
  codebase: string | null;
  state: string;
}

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
