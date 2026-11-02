import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  findGuessingStoredUnions,
  findNonPlainStoredSchemas,
  storedDocumentSchemaGuard,
  type StoredDocumentSchemaFacts,
} from '../../src/modules/firestore/stored-schema-guard.js';
import { createRepoReader } from '../../src/node/reader.js';
import { buildOf, factProblemsOf } from '../helpers/configured.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const CORE = 'node_modules/@app/core/dist';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const registry = (COLLECTION_SCHEMAS: Record<string, unknown>): StoredDocumentSchemaFacts => ({
  docSchemas: () => ({ COLLECTION_SCHEMAS }),
});

function contextWithCore(compiled = true) {
  repo = tempRepo({
    'src/app.ts': 'export {};',
    [`${CORE}/index.d.ts`]: 'export {};',
    ...(compiled ? { [`${CORE}/index.js`]: 'export {};' } : {}),
  });
  return contextOf(
    createRepoReader({
      repoRoot: repo.root,
      roots: {
        app: { path: 'src', anchor: 'src/app.ts' },
        coreDist: { path: CORE, anchor: `${CORE}/index.d.ts` },
      },
    }),
  );
}

const find = (facts: StoredDocumentSchemaFacts) =>
  findNonPlainStoredSchemas(facts, contextWithCore());

describe('every stored-document schema is plain', () => {
  it('PASSES a registry of plain objects at every depth', async () => {
    expect(
      await find(
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
      await find(
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
    const findings = await find(
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

  it('FLAGS a layout whose installed core holds no compiled module', async () => {
    expect(
      await findNonPlainStoredSchemas(
        registry({ 'teams/{teamId}': z.object({ name: z.string() }) }),
        contextWithCore(false),
      ),
    ).toEqual([
      { file: '(core build)', detail: 'the installed core build holds no compiled module' },
    ]);
  });

  it('runs as the first check of the guard over the loaded registry', async () => {
    const [guard] = buildOf(
      storedDocumentSchemaGuard,
      registry({ 'teams/{teamId}': z.strictObject({ name: z.string() }) }),
    );
    expect(await guard!.run(contextWithCore())).toHaveLength(1);
  });

  it('throws when the docSchemas entry exports no registry', async () => {
    await expect(find({ docSchemas: () => ({}) })).rejects.toThrow('exports no COLLECTION_SCHEMAS');
  });

  it('reports a missing docSchemas loader', () => {
    expect(factProblemsOf(storedDocumentSchemaGuard, {})).toEqual([
      'docSchemas needs a loader function',
    ]);
  });
});

describe('no stored document is read through a union that guesses its shape', () => {
  const findUnions = (facts: StoredDocumentSchemaFacts) =>
    findGuessingStoredUnions(facts, contextWithCore());
  const basketball = z.object({ sport: z.literal('basketball'), rebounds: z.number() });
  const curling = z.object({ sport: z.literal('curling'), ends: z.number() });

  it('PASSES a discriminated union of object shapes, and a union of values that are not object shapes', async () => {
    expect(
      await findUnions(
        registry({
          'teams/{teamId}': z.object({
            line: z.discriminatedUnion('sport', [basketball, curling]),
            value: z.union([z.number(), z.string(), z.record(z.string(), z.number()), z.null()]),
            maybe: z.union([z.null(), basketball]),
          }),
        }),
      ),
    ).toEqual([]);
  });

  it('FAILS a plain union of two object shapes at any depth, named once at the first document path', async () => {
    const Guess = z.union([z.object({ wins: z.number() }), z.object({ ends: z.number() })]);
    expect(
      await findUnions(
        registry({
          'teams/{teamId}': z.object({ season: Guess.optional() }),
          'games/{gameId}': z.object({ rows: z.record(z.string(), Guess) }),
          'awards/{id}': z.array(z.union([basketball, curling])),
        }),
      ),
    ).toEqual([
      {
        file: 'teams/{teamId}',
        detail: 'teams/{teamId}.season: a union of object shapes with no discriminator',
      },
      {
        file: 'awards/{id}',
        detail: 'awards/{id}[]: a union of object shapes with no discriminator',
      },
    ]);
  });

  it('FAILS a plain union whose member is a discriminated union beside another object shape', async () => {
    const findings = await findUnions(
      registry({
        'archive/{id}': z.union([
          z.discriminatedUnion('sport', [basketball, curling]),
          z.object({ parseFailed: z.literal(true) }),
        ]),
      }),
    );
    expect(findings.map((finding) => finding.detail)).toEqual([
      'archive/{id}: a union of object shapes with no discriminator',
    ]);
  });

  it('runs as the second check of the guard over the loaded registry', async () => {
    const [, guard] = buildOf(
      storedDocumentSchemaGuard,
      registry({ 'teams/{teamId}': z.union([basketball, curling]) }),
    );
    expect(await guard!.run(contextWithCore())).toHaveLength(1);
  });
});
