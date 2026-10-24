import type { Guard } from '../../guard.js';
import { layoutProblems } from '../reader.js';
import { declaredRoots, type RepoLayout, type RootRole } from '../layout.js';

export interface Absent {
  absent: string;
}

export interface GenericGuardDefinition<Facts> {
  id: string;
  absentWhen: string | false;
  absentOnlyWithoutRoot?: RootRole;
  factProblems(facts: Facts): string[];
  build(facts: Facts): Guard[];
}

// The suite holds guards of every facts type in one list, so it hands each the config value as it
// arrived; factProblems checks that value before build runs.
export interface ConfiguredGuardDefinition {
  factProblems(facts: unknown): string[];
  build(facts: unknown): Guard[];
}

export const isAbsent = (value: unknown): value is Absent =>
  !!value &&
  typeof value === 'object' &&
  Object.keys(value).length === 1 &&
  typeof (value as Absent).absent === 'string';

export function configProblems(
  config: {
    layout: RepoLayout;
    generic: Readonly<Record<string, unknown>>;
    business: readonly Guard[];
  },
  definitions: ReadonlyArray<GenericGuardDefinition<never>>,
): string[] {
  const problems: string[] = [];
  if (!config || typeof config !== 'object') return ['the guard config is missing'];
  problems.push(...layoutProblems(config.layout));
  const generic = config.generic ?? {};
  const known = new Set(definitions.map((d) => d.id));
  for (const key of Object.keys(generic))
    if (!known.has(key)) problems.push(`generic.${key} names no guard this package carries`);
  for (const definition of definitions) {
    if (!(definition.id in generic)) {
      problems.push(
        `generic.${definition.id} is missing — every guard needs its facts${definition.absentWhen ? ' or an { absent: why }' : ''}`,
      );
      continue;
    }
    const value = generic[definition.id];
    if (isAbsent(value)) {
      if (!definition.absentWhen)
        problems.push(`generic.${definition.id} cannot be declared absent: every app runs it`);
      else if (!value.absent.trim())
        problems.push(`generic.${definition.id} is declared absent with no why`);
      else if (
        definition.absentOnlyWithoutRoot &&
        config.layout?.roots &&
        declaredRoots(config.layout).some((r) => r.role === definition.absentOnlyWithoutRoot)
      ) {
        problems.push(
          `generic.${definition.id} is declared absent, but the layout declares a ${definition.absentOnlyWithoutRoot} root for it to check`,
        );
      }
      continue;
    }
    const configured: ConfiguredGuardDefinition = definition;
    for (const problem of configured.factProblems(value))
      problems.push(`generic.${definition.id}: ${problem}`);
  }
  const titles = new Set<string>();
  for (const guard of config.business ?? []) {
    if (!guard || typeof guard.run !== 'function' || !guard.title) {
      problems.push('a business guard was not built from a shape');
      continue;
    }
    if (titles.has(guard.title))
      problems.push(`two business guards share the title "${guard.title}"`);
    titles.add(guard.title);
    if (!guard.samples) problems.push(`business guard "${guard.title}" carries no samples`);
  }
  return problems;
}

export function buildGenericGuards(
  generic: Readonly<Record<string, unknown>>,
  definitions: ReadonlyArray<GenericGuardDefinition<never>>,
): Guard[] {
  return definitions.flatMap((definition) => {
    const configured: ConfiguredGuardDefinition = definition;
    return isAbsent(generic[definition.id]) ? [] : configured.build(generic[definition.id]);
  });
}
