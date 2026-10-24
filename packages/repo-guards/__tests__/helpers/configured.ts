import type { ConfiguredGuardDefinition } from '../../src/node/suite/config.js';

// A guard's facts arrive from an app's config as an unchecked value, so a test hands factProblems
// and build exactly that — a malformed value included — through the suite's own view.
export const factProblemsOf = (definition: ConfiguredGuardDefinition, facts: unknown): string[] =>
  definition.factProblems(facts);

export const buildOf = (definition: ConfiguredGuardDefinition, facts: unknown) =>
  definition.build(facts);
