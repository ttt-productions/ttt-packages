import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  findNonPlainStoredSchemas,
  storedDocumentSchemaGuard,
} from '../../src/modules/firestore/stored-schema-guard.js';
import { createRepoReader } from '../../src/node/reader.js';
import { buildOf, factProblemsOf } from '../helpers/configured.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo } from '../helpers/temp-repo.js';

const registry = (COLLECTION_SCHEMAS: Record<string, unknown>) => ({
  docSchemas: () => ({ COLLECTION_SCHEMAS }),
});

describe('every stored-document schema is plain', () => {
  it('PASSES a registry of plain objects at every depth', async () => {
    expect(
      await findNonPlainStoredSchemas(
        registry({
          'teams/{teamId}': z.object({
            name: z.string(),
            stats: z.record(z.string(), z.object({ wins: z.number() })),
            members: z.array(z.object({ userId: z.string() })),
          }),
        }),
      ),
    ).toEqual([]);
  });

  it('FAILS a strict, a passthrough, and a catchall object, each named at its document path', async () => {
    expect(
      await findNonPlainStoredSchemas(
        registry({
          'teams/{teamId}': z.strictObject({ name: z.string() }),
          'games/{gameId}': z.object({
            score: z.object({ home: z.number() }).passthrough(),
            notes: z.array(z.object({ text: z.string() }).catchall(z.string())),
          }),
        }),
      ),
    ).toEqual([
      {
        file: 'teams/{teamId}',
        detail: 'teams/{teamId}: refuses an undeclared field (.strict() / z.strictObject)',
      },
      {
        file: 'games/{gameId}',
        detail: 'games/{gameId}.score: keeps an undeclared field (.passthrough() / z.looseObject)',
      },
      {
        file: 'games/{gameId}',
        detail: 'games/{gameId}.notes[]: keeps an undeclared field through a catchall',
      },
    ]);
  });

  it('FAILS a strict object a union option reaches, and names a shape two documents share once', async () => {
    const Shared = z.strictObject({ bucket: z.string(), path: z.string() });
    const findings = await findNonPlainStoredSchemas(
      registry({
        'waivers/{id}': z.object({ file: Shared }),
        'contracts/{id}': z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('a'), file: Shared }),
          z.object({ kind: z.literal('b'), extra: z.strictObject({ n: z.number() }) }),
        ]),
      }),
    );
    expect(findings.map((finding) => finding.detail)).toEqual([
      'waivers/{id}.file: refuses an undeclared field (.strict() / z.strictObject)',
      'contracts/{id}|1.extra: refuses an undeclared field (.strict() / z.strictObject)',
    ]);
  });

  it('runs as one guard over the loaded registry', async () => {
    const [guard] = buildOf(
      storedDocumentSchemaGuard,
      registry({ 'teams/{teamId}': z.strictObject({ name: z.string() }) }),
    );
    const repo = tempRepo({ 'src/anchor.ts': 'export {};' });
    try {
      const reader = createRepoReader({
        repoRoot: repo.root,
        roots: { app: { path: 'src', anchor: 'src/anchor.ts' } },
      });
      expect(await guard!.run(contextOf(reader))).toHaveLength(1);
    } finally {
      repo.remove();
    }
  });

  it('throws when the docSchemas entry exports no registry', async () => {
    await expect(findNonPlainStoredSchemas({ docSchemas: () => ({}) })).rejects.toThrow(
      'exports no COLLECTION_SCHEMAS',
    );
  });

  it('reports a missing docSchemas loader', () => {
    expect(factProblemsOf(storedDocumentSchemaGuard, {})).toEqual([
      'docSchemas needs a loader function',
    ]);
  });
});
