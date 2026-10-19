// An app's guard config, and the one check that decides whether it can run. Every generic guard the
// package carries needs its facts in the config — or, where the guard allows it, an explicit
// absence with its why. Nothing is skipped by leaving it out.

import type { Guard } from '../../guard.js';
import { layoutProblems } from '../reader.js';
import { declaredRoots, type RepoLayout, type RootRole } from '../layout.js';

/** An app's statement that a generic guard does not apply to it, and why. */
export interface Absent {
  absent: string;
}

/** One generic guard as the package defines it: how to check its facts and build its tests. */
export interface GenericGuardDefinition<Facts> {
  /** The guard's key in the app's config. */
  id: string;
  /** When an app may declare the guard absent (a feature it does not have), or false when never. */
  absentWhen: string | false;
  /**
   * The root whose tree the guard checks, when the absence it allows is that tree's: such a guard may
   * be declared absent only when the layout declares no root of this role.
   */
  absentOnlyWithoutRoot?: RootRole;
  factProblems(facts: Facts): string[];
  build(facts: Facts): Guard[];
}

export const isAbsent = (value: unknown): value is Absent =>
  !!value && typeof value === 'object' && Object.keys(value).length === 1 && typeof (value as Absent).absent === 'string';

/** Every problem with a config, in words, against the package's generic guards. Empty = runnable. */
export function configProblems(
  config: { layout: RepoLayout; generic: Readonly<Record<string, unknown>>; business: readonly Guard[] },
  definitions: ReadonlyArray<GenericGuardDefinition<never>>,
): string[] {
  const problems: string[] = [];
  if (!config || typeof config !== 'object') return ['the guard config is missing'];
  problems.push(...layoutProblems(config.layout));
  const generic = config.generic ?? {};
  const known = new Set(definitions.map((d) => d.id));
  for (const key of Object.keys(generic)) if (!known.has(key)) problems.push(`generic.${key} names no guard this package carries`);
  for (const definition of definitions) {
    if (!(definition.id in generic)) {
      problems.push(`generic.${definition.id} is missing — every guard needs its facts${definition.absentWhen ? ' or an { absent: why }' : ''}`);
      continue;
    }
    const value = generic[definition.id];
    if (isAbsent(value)) {
      if (!definition.absentWhen) problems.push(`generic.${definition.id} cannot be declared absent: every app runs it`);
      else if (!value.absent.trim()) problems.push(`generic.${definition.id} is declared absent with no why`);
      else if (definition.absentOnlyWithoutRoot && config.layout?.roots && declaredRoots(config.layout).some((r) => r.role === definition.absentOnlyWithoutRoot)) {
        problems.push(`generic.${definition.id} is declared absent, but the layout declares a ${definition.absentOnlyWithoutRoot} root for it to check`);
      }
      continue;
    }
    for (const problem of definition.factProblems(value as never)) problems.push(`generic.${definition.id}: ${problem}`);
  }
  const titles = new Set<string>();
  for (const guard of config.business ?? []) {
    if (!guard || typeof guard.run !== 'function' || !guard.title) {
      problems.push('a business guard was not built from a shape');
      continue;
    }
    if (titles.has(guard.title)) problems.push(`two business guards share the title "${guard.title}"`);
    titles.add(guard.title);
    if (!guard.samples) problems.push(`business guard "${guard.title}" carries no samples`);
  }
  return problems;
}

/** The generic guards' tests, built from the app's facts; absent guards build none. */
export function buildGenericGuards(
  generic: Readonly<Record<string, unknown>>,
  definitions: ReadonlyArray<GenericGuardDefinition<never>>,
): Guard[] {
  return definitions.flatMap((d) => (isAbsent(generic[d.id]) ? [] : d.build(generic[d.id] as never)));
}
