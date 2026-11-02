import type { Finding, GuardContext } from '../../guard.js';
import { coreBuild } from '../core-definitions/shared.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { type Loader, loaderProblem } from '../../support/facts.js';
import { GUARD_TIMEOUT_MS } from '../../support/timeouts.js';
import { guessingUnions, reachedObjects } from '../../zod-shape/zod-shape.js';

export interface StoredDocumentSchemaFacts {
  docSchemas: Loader<Record<string, unknown>>;
}

const MODE_WORDS = {
  strict: 'refuses an undeclared field (.strict() / z.strictObject)',
  loose: 'keeps an undeclared field (.passthrough() / z.looseObject)',
  catchall: 'keeps an undeclared field through a catchall',
} as const;

async function loadRegistry(
  facts: StoredDocumentSchemaFacts,
  context: GuardContext,
  findings: Finding[],
): Promise<Record<string, unknown>> {
  // The registry is loaded from the core build, so the build is what the guard reads.
  coreBuild(context, findings);
  const { COLLECTION_SCHEMAS } = await facts.docSchemas();
  if (!COLLECTION_SCHEMAS || typeof COLLECTION_SCHEMAS !== 'object')
    throw new Error("repo-guards: the core's docSchemas entry exports no COLLECTION_SCHEMAS");
  return COLLECTION_SCHEMAS as Record<string, unknown>;
}

export async function findNonPlainStoredSchemas(
  facts: StoredDocumentSchemaFacts,
  context: GuardContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const registry = await loadRegistry(facts, context, findings);
  const reported = new Set<unknown>();
  for (const [template, schema] of Object.entries(registry)) {
    for (const object of reachedObjects(schema, template)) {
      if (object.mode === 'plain' || reported.has(object.schema)) continue;
      reported.add(object.schema);
      findings.push({ file: template, detail: `${object.path}: ${MODE_WORDS[object.mode]}` });
    }
  }
  return findings;
}

export async function findGuessingStoredUnions(
  facts: StoredDocumentSchemaFacts,
  context: GuardContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const registry = await loadRegistry(facts, context, findings);
  const reported = new Set<unknown>();
  for (const [template, schema] of Object.entries(registry)) {
    for (const union of guessingUnions(schema, template)) {
      if (reported.has(union.schema)) continue;
      reported.add(union.schema);
      findings.push({
        file: template,
        detail: `${union.path}: a union of object shapes with no discriminator`,
      });
    }
  }
  return findings;
}

export const storedDocumentSchemaGuard: GenericGuardDefinition<StoredDocumentSchemaFacts> = {
  id: 'storedDocumentSchemasPlain',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    loaderProblem(facts?.docSchemas, 'docSchemas', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every stored-document schema is plain',
        description:
          'Every object schema a registered document schema reaches is a plain z.object: a field it does not name is ' +
          'dropped on read, never refused and never kept. A strict, passthrough, or catchall object anywhere in a ' +
          'stored document fails, named once at the first document path that reaches it. A callable input that ' +
          'carries a stored shape takes a strict copy of it instead. The registry is read from the installed core build.',
        timeoutMs: GUARD_TIMEOUT_MS,
        run: (context) => findNonPlainStoredSchemas(facts, context),
      },
      {
        title: 'no stored document is read through a union that guesses its shape',
        description:
          'Every union of object shapes a registered document schema reaches is a discriminated union: a value is ' +
          'read by the shape its discriminator names, never as the first member it happens to parse as, which reads ' +
          "a damaged value of one shape as another's. A plain union holding two or more object shapes fails, named " +
          'once at the first document path that reaches it. The registry is read from the installed core build.',
        timeoutMs: GUARD_TIMEOUT_MS,
        run: (context) => findGuessingStoredUnions(facts, context),
      },
    ];
  },
};
