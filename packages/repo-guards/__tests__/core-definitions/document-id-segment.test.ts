// Every id a client sends is one document-id segment: each id atom, and each id-named field of a wire
// contract, refuses an empty id, a "/", "." / "..", and the reserved __name__ form; and every
// id-named field a client sends, reviewed or not, refuses a space-only or space-padded value.

import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { documentIdSegmentGuard, type DocumentIdSegmentFacts } from '../../src/modules/core-definitions/document-id-segment.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo } from '../helpers/temp-repo.js';
import { CORE, fixture, lines } from './fixture.js';

const unpadded = z.string().min(1).refine((s) => s === s.trim());
const segmentId = unpadded.regex(/^(?!\.\.?$)(?!__.*__$)[^/]+$/);
const parentRef = unpadded.regex(/^[^/]+(\/[^/]+)?$/);

const cleanModules = {
  schemas: {
    thingIdSchema: segmentId,
    kindIdSchema: z.enum(['alpha', 'beta']),
    parentRefSchema: parentRef,
    DoThingInputSchema: z.object({
      thingId: segmentId,
      parentItemId: parentRef,
      note: z.string(),
      items: z.array(z.object({ itemId: segmentId })).optional(),
    }),
    SignedApplyRequestSchema: z.object({ id: z.string() }),
    ImportInputSchema: z.object({ requestId: unpadded }),
    ShareInputSchema: z.object({ uids: z.array(segmentId), ids: z.array(segmentId) }),
  },
  media: {
    AttachTargetInfoSchema: z.object({ ownerUid: segmentId }),
  },
};

const facts = (modules: Record<string, Record<string, unknown>>, overrides: Partial<DocumentIdSegmentFacts> = {}): DocumentIdSegmentFacts => ({
  wireModules: () => modules,
  wireInputNameSuffixes: ['InputSchema', 'RequestSchema', 'TargetInfoSchema'],
  idAtomNameSuffix: 'IdSchema',
  requiredWireInputs: ['DoThingInputSchema'],
  requiredIdAtoms: ['thingIdSchema'],
  notClientSent: [{ schema: 'SignedApplyRequestSchema', why: 'signed server to server; no client composes it' }],
  notAPathSegment: [{ field: 'ImportInputSchema.requestId', why: 'an idempotency key the server hashes' }],
  multiSegmentReferences: [{ schema: 'parentRefSchema', why: 'a parent of one or two ids' }],
  ...overrides,
});

const f = fixture({ [`${CORE}/kinds.js`]: 'export const KIND = 1;' });
afterAll(() => f.repo.remove());

const run = async (index: 0 | 1 | 2, modules: Record<string, Record<string, unknown>>, overrides?: Partial<DocumentIdSegmentFacts>) =>
  lines(await f.run(documentIdSegmentGuard.build(facts(modules, overrides))[index]));

describe('id atoms', () => {
  it('passes atoms that admit exactly one segment, an enum atom included', async () => {
    expect(await run(0, cleanModules)).toEqual([]);
  });

  it('FLAGS an atom that admits a value that is not one segment, one that refuses a plain id, and a required atom that is missing', async () => {
    const modules = {
      schemas: {
        looseIdSchema: z.string(),
        numericIdSchema: segmentId.regex(/^\d+$/),
      },
    };
    expect(await run(0, modules)).toEqual([
      '(core) thingIdSchema — a required id atom was not found among the wire modules',
      '(core) looseIdSchema — admits "", "a/b", "/a", "a/", ".", "..", "__reserved__"',
      '(core) numericIdSchema — refuses the plain id "abc123XYZ"',
    ]);
  });
});

describe('id fields of wire contracts', () => {
  it('passes one-segment fields, a reviewed multi-segment reference, a reviewed non-id field, and a contract no client sends', async () => {
    expect(await run(1, cleanModules)).toEqual([]);
  });

  it('FLAGS an inline id field nested in a union, an array, and an optional, naming the nearest exported schema', async () => {
    const shared = z.object({ ownerUid: z.string().min(1) });
    const modules = {
      schemas: {
        ...cleanModules.schemas,
        SharedOwnerSchema: shared,
        DoThingInputSchema: z.object({
          thingId: segmentId,
          action: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('a'), items: z.array(z.object({ thingId: z.string().min(1) })).optional() }),
            z.object({ kind: z.literal('b'), owner: shared }),
          ]),
          thingIds: z.array(z.string()),
        }),
      },
    };
    expect(await run(1, modules)).toEqual([
      '(core) DoThingInputSchema.action.items.thingId — admits a value that is not one document-id segment',
      '(core) DoThingInputSchema.thingIds — admits a value that is not one document-id segment',
      '(core) SharedOwnerSchema.ownerUid — admits a value that is not one document-id segment',
    ]);
  });

  it('FLAGS a stale reviewed field, a stale not-client-sent entry, a stale multi-segment reference, and a missing required contract', async () => {
    const modules = {
      schemas: {
        thingIdSchema: segmentId,
        ImportInputSchema: z.object({ requestId: segmentId }),
      },
    };
    expect(await run(1, modules)).toEqual([
      '(core) parentRefSchema — stale multi-segment reference: the core exports no such schema',
      '(core) SignedApplyRequestSchema — stale not-client-sent entry: no such wire contract',
      '(core) DoThingInputSchema — a required wire contract was not found among the wire modules',
      '(core) ImportInputSchema.requestId — stale reviewed entry: the field is gone or now one segment',
    ]);
  });

  it('FLAGS a layout whose installed core holds no compiled module', async () => {
    const repo = tempRepo({ 'src/app.ts': 'export {};', [`${CORE}/index.d.ts`]: 'export {};' });
    try {
      const reader = createRepoReader({
        repoRoot: repo.root,
        roots: { app: { path: 'src', anchor: 'src/app.ts' }, coreDist: { path: CORE, anchor: `${CORE}/index.d.ts` } },
      });
      const [guard] = documentIdSegmentGuard.build(facts(cleanModules));
      expect(lines(await guard.run(contextOf(reader)))).toEqual(['(core build) — the installed core build holds no compiled module']);
    } finally {
      repo.remove();
    }
  });
});

describe('id fields refuse padding', () => {
  it('passes fields that refuse a space-only or padded value, the reviewed ones included', async () => {
    expect(await run(2, cleanModules)).toEqual([]);
  });

  it('FLAGS a padded-accepting id field, a reviewed non-segment one, a multi-segment one, and lowercase plural ids / uids', async () => {
    const padded = z.string().min(1).regex(/^[^/]+$/);
    const modules = {
      schemas: {
        ...cleanModules.schemas,
        parentRefSchema: z.string().regex(/^[^/]+(\/[^/]+)?$/),
        DoThingInputSchema: z.object({ thingId: padded, parentItemId: z.string().regex(/^[^/]+(\/[^/]+)?$/) }),
        ImportInputSchema: z.object({ requestId: z.string().min(1) }),
        ShareInputSchema: z.object({ uids: z.array(padded), ids: z.array(padded) }),
      },
    };
    expect(await run(2, modules)).toEqual([
      '(core) DoThingInputSchema.parentItemId — admits a space-only or space-padded value',
      '(core) DoThingInputSchema.thingId — admits a space-only or space-padded value',
      '(core) ImportInputSchema.requestId — admits a space-only or space-padded value',
      '(core) ShareInputSchema.ids — admits a space-only or space-padded value',
      '(core) ShareInputSchema.uids — admits a space-only or space-padded value',
    ]);
  });
});

describe('an admin-list field named for the uids it holds', () => {
  const weakUid = z.string().min(1).max(128);
  const asNamed = (field: string) => ({ schemas: { ...cleanModules.schemas, UpdateAdminListInputSchema: z.object({ [field]: z.array(weakUid).optional() }) } });

  it('is invisible to both probes while its name does not say it holds uids', async () => {
    expect(await run(1, asNamed('addAdmins'))).toEqual([]);
    expect(await run(2, asNamed('addAdmins'))).toEqual([]);
  });

  it('FLAGS a weak uid copy once the field is named for its uids', async () => {
    expect(await run(1, asNamed('addAdminUids'))).toEqual(['(core) UpdateAdminListInputSchema.addAdminUids — admits a value that is not one document-id segment']);
    expect(await run(2, asNamed('addAdminUids'))).toEqual(['(core) UpdateAdminListInputSchema.addAdminUids — admits a space-only or space-padded value']);
  });
});

describe('the facts', () => {
  it('refuses a missing loader, empty name lists, and a reviewed entry with no why', () => {
    expect(
      documentIdSegmentGuard.factProblems({
        ...facts(cleanModules),
        wireModules: undefined as never,
        wireInputNameSuffixes: [],
        idAtomNameSuffix: '',
        requiredIdAtoms: [],
        notAPathSegment: [{ field: 'X.id', why: '' }],
      }),
    ).toEqual([
      'wireModules needs a loader function',
      'wireInputNameSuffixes is empty',
      'idAtomNameSuffix is missing',
      'requiredIdAtoms is empty',
      'notAPathSegment entry X.id carries no why',
    ]);
  });
});
