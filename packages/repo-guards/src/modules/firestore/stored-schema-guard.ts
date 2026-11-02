import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { type Loader, loaderProblem } from '../../support/facts.js';
import { GUARD_TIMEOUT_MS } from '../../support/timeouts.js';
import { reachedObjects } from '../../zod-shape/zod-shape.js';

export interface StoredDocumentSchemaFacts {
  docSchemas: Loader<Record<string, unknown>>;
}

const MODE_WORDS = {
  strict: 'refuses an undeclared field (.strict() / z.strictObject)',
  loose: 'keeps an undeclared field (.passthrough() / z.looseObject)',
  catchall: 'keeps an undeclared field through a catchall',
} as const;

export async function findNonPlainStoredSchemas(
  facts: StoredDocumentSchemaFacts,
): Promise<Finding[]> {
  const { COLLECTION_SCHEMAS } = await facts.docSchemas();
  if (!COLLECTION_SCHEMAS || typeof COLLECTION_SCHEMAS !== 'object')
    throw new Error("repo-guards: the core's docSchemas entry exports no COLLECTION_SCHEMAS");
  const findings: Finding[] = [];
  const reported = new Set<unknown>();
  for (const [template, schema] of Object.entries(COLLECTION_SCHEMAS as Record<string, unknown>)) {
    for (const object of reachedObjects(schema, template)) {
      if (object.mode === 'plain' || reported.has(object.schema)) continue;
      reported.add(object.schema);
      findings.push({ file: template, detail: `${object.path}: ${MODE_WORDS[object.mode]}` });
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
          'carries a stored shape takes a strict copy of it instead.',
        timeoutMs: GUARD_TIMEOUT_MS,
        run: () => findNonPlainStoredSchemas(facts),
      },
    ];
  },
};
