import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import * as schemas from '../src/schemas';
import * as media from '../src/media';
import * as uploadVariables from '../src/upload-variables';
import {
  documentIdSegmentSchema,
  reportTargetItemIdSchema,
  reportTargetParentRefSchema,
} from '../src/schemas/atoms';
import { FollowTargetInputSchema, UnfollowTargetInputSchema } from '../src/schemas/social';
import { MediaGrantScopeSchema, MediaGrantTokenPayloadSchema } from '../src/media/edge-serving-contract';
import { FIRESTORE_DOCUMENT_ID_MAX_BYTES } from '../src/constants/business';

// An id a client sends becomes a path segment, so every id atom must admit exactly one segment:
// a "/" addresses a different document or a subcollection, an empty id addresses the collection,
// and "." / ".." / the reserved __name__ form are not document ids.
const NOT_ONE_SEGMENT = ['', 'a/b', '/a', 'a/', '.', '..', '__reserved__'];

type ZodLike = { safeParse: (value: unknown) => { success: boolean }; def?: { type?: string } };

const WIRE_MODULES = { schemas, media, uploadVariables } as unknown as Record<string, Record<string, unknown>>;

const idAtoms = Object.values(WIRE_MODULES)
  .flatMap((module) => Object.entries(module))
  .filter(
    (entry): entry is [string, ZodLike] =>
      /IdSchema$/.test(entry[0]) && typeof (entry[1] as ZodLike | undefined)?.safeParse === 'function',
  );

// ---------------------------------------------------------------------------
// Inline id fields. A wire contract a client sends — a callable input, an upload's target info
// or variables, a route body — names an id field `…Id` / `…Ids` / `…Uid` / `id` / `uid`, and the
// field must refuse every value that is not one segment, whether it derives from an atom or is
// declared inline, so a NEW field that skips the atom fails here.
// ---------------------------------------------------------------------------

const WIRE_INPUT_SCHEMA_NAME = /(Input|Request|TargetInfo|Variables|Body)Schema$/;
const ID_FIELD_NAME = /^(id|uid)$|(Id|Ids|Uid|Uids)$/;

/** Wire schemas a client never composes, so their ids are not client input. */
const NOT_CLIENT_SENT: Record<string, string> = {
  MediaAuthorityApplyRequestSchema:
    'the body the Functions tree signs and the media Worker verifies before it parses; no client composes it',
};

/** Id-named fields that are not a document id, keyed `<nearest exported schema>.<field path>`. */
const NOT_A_PATH_SEGMENT: Record<string, string> = {
  'FuturePlanItemInputSchema.id': 'an item key inside a public document\'s stored content, never a path segment',
  'PlatformRuleInputSchema.id': 'an item key inside a public document\'s stored content, never a path segment',
  'ContentPageSectionInputSchema.id': 'an item key inside a public document\'s stored content, never a path segment',
  'DmcaPolicyContentInputSchema.contactBlocks.id': 'an item key inside a public document\'s stored content, never a path segment',
  'DmcaPolicyContentInputSchema.contactBlocks.rows.id': 'an item key inside a public document\'s stored content, never a path segment',
  'StartUploadRequestSchema.clientContext.targetIds':
    'a generic media-schemas display hint the upload tray matches on; no backend builds a path from it',
  'GetMyPledgeByCheckoutSessionInputSchema.sessionId':
    'Stripe\'s Checkout session id, matched as a query value against the server-only provider reference, never a path segment',
  'MarkNcmecPortalCompleteInputSchema.ncmecReportId': 'NCMEC\'s own report number, stored as a value',
  'RecordNcmecPortalCorrectionInputSchema.ncmecReportId': 'NCMEC\'s own report number, stored as a value',
  'CreateNotificationBroadcastInputSchema.requestId':
    'a client idempotency key the server hashes into the broadcast\'s deterministic id, never a path segment',
  'EnqueueArchiveAllInputSchema.requestId':
    'a client idempotency key the server hashes into the archive-all job id, never a path segment',
  'ArchiveNotificationObservedInputSchema.requestId':
    'a client idempotency key the server hashes into a deterministic id, never a path segment',
};

type AnyDef = { type: string } & Record<string, unknown>;
const defOf = (schema: unknown): AnyDef | undefined =>
  (schema as { _zod?: { def?: AnyDef } } | undefined)?._zod?.def;

const WRAPPERS = new Set(['optional', 'nullable', 'default', 'prefault', 'readonly', 'catch', 'nonoptional']);

/** The schema a field's VALUE is checked by: wrappers and arrays unwrapped to the element. */
function leafOf(schema: unknown): unknown {
  let current = schema;
  for (let def = defOf(current); def; def = defOf(current)) {
    if (WRAPPERS.has(def.type)) current = def.innerType;
    else if (def.type === 'array') current = def.element;
    else if (def.type === 'pipe') current = def.in;
    else break;
  }
  return current;
}

/** Every id-named field under `root` that admits a value which is not one segment. */
function nonSegmentIdFields(root: unknown, rootName: string, exportedNames: Map<unknown, string>): string[] {
  const found = new Set<string>();
  const visiting = new Set<unknown>();
  const visit = (schema: unknown, path: string) => {
    const def = defOf(schema);
    if (!def || visiting.has(schema)) return;
    const exported = schema === root ? undefined : exportedNames.get(schema);
    const at = exported ?? path;
    visiting.add(schema);
    if (def.type === 'object') {
      for (const [key, field] of Object.entries(def.shape as Record<string, unknown>)) {
        const fieldPath = `${at}.${key}`;
        const leaf = leafOf(field);
        if (ID_FIELD_NAME.test(key) && leaf !== reportTargetParentRefSchema) {
          const admitted = NOT_ONE_SEGMENT.filter((value) => (leaf as ZodLike).safeParse?.(value).success);
          if (admitted.length > 0) found.add(fieldPath);
        }
        visit(field, fieldPath);
      }
    } else if (WRAPPERS.has(def.type)) {
      visit(def.innerType, at);
    } else if (def.type === 'array') {
      visit(def.element, at);
    } else if (def.type === 'union') {
      for (const option of def.options as unknown[]) visit(option, at);
    } else if (def.type === 'intersection') {
      visit(def.left, at);
      visit(def.right, at);
    } else if (def.type === 'pipe') {
      visit(def.in, at);
    } else if (def.type === 'lazy') {
      visit((def.getter as () => unknown)(), at);
    }
    visiting.delete(schema);
  };
  visit(root, rootName);
  return [...found];
}

const exportedSchemaNames = new Map<unknown, string>();
for (const module of Object.values(WIRE_MODULES)) {
  for (const [name, value] of Object.entries(module)) {
    if (defOf(value) && !exportedSchemaNames.has(value)) exportedSchemaNames.set(value, name);
  }
}

const wireInputs = Object.values(WIRE_MODULES)
  .flatMap((module) => Object.entries(module))
  .filter(([name, value]) => WIRE_INPUT_SCHEMA_NAME.test(name) && defOf(value) && !(name in NOT_CLIENT_SENT));

describe('every id field a client sends is one document-id segment', () => {
  const offenders = new Set<string>();
  for (const [name, schema] of wireInputs) {
    for (const field of nonSegmentIdFields(schema, name, exportedSchemaNames)) offenders.add(field);
  }

  it('finds the wire inputs the clients send', () => {
    const names = wireInputs.map(([name]) => name);
    expect(names).toContain('SubmitReportInputSchema');
    expect(names).toContain('WorkAssetTargetInfoSchema');
    expect(names).toContain('UploadWorkFileVariablesSchema');
  });

  it('admits no value that is not one segment in any id field outside the reviewed list', () => {
    const unexpected = [...offenders].filter((field) => !(field in NOT_A_PATH_SEGMENT)).sort();
    expect(unexpected).toEqual([]);
  });

  it('keeps no reviewed entry whose field is gone or now one segment', () => {
    const stale = Object.keys(NOT_A_PATH_SEGMENT).filter((field) => !offenders.has(field)).sort();
    expect(stale).toEqual([]);
  });

  it('finds an inline id field nested in a union, an array, and an optional', () => {
    const Fixture = z.object({
      action: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('a'), items: z.array(z.object({ thingId: z.string().min(1) })).optional() }),
        z.object({ kind: z.literal('b'), ownerUid: documentIdSegmentSchema }),
      ]),
      parentItemId: reportTargetParentRefSchema,
    });
    expect(nonSegmentIdFields(Fixture, 'FixtureInputSchema', new Map())).toEqual(['FixtureInputSchema.action.items.thingId']);
  });
});

describe('signed media grants', () => {
  it('name one segment for every id they carry, so a verified grant cannot reach another path', () => {
    expect(MediaGrantScopeSchema.safeParse({ w: 'work-1' }).success).toBe(true);
    for (const scope of [{ w: 'work-1/x' }, { gi: '..' }, { wf: { w: 'work-1', f: 'a/b' } }, { as: { d: '' } }, { ar: '__x__' }]) {
      expect(MediaGrantScopeSchema.safeParse(scope).success, JSON.stringify(scope)).toBe(false);
    }
    const grant = { v: 1, typ: 'grant', uid: 'user/1', exp: 1, scope: { w: 'work-1' } };
    expect(MediaGrantTokenPayloadSchema.safeParse(grant).success).toBe(false);
  });
});

describe('every exported id atom admits exactly one document-id segment', () => {
  it('finds the id atoms the wire contracts use', () => {
    const names = idAtoms.map(([name]) => name);
    expect(names).toContain('workProjectIdSchema');
    expect(names).toContain('mediaAssetIdSchema');
    expect(names).toContain('userIdSchema');
  });

  for (const [name, atom] of idAtoms) {
    it(`${name} refuses a value that is not one segment`, () => {
      for (const value of NOT_ONE_SEGMENT) {
        expect(atom.safeParse(value).success, `${name} accepted ${JSON.stringify(value)}`).toBe(false);
      }
    });

    it(`${name} accepts a plain id`, () => {
      if (atom.def?.type === 'enum') return;
      expect(atom.safeParse('abc123XYZ').success).toBe(true);
    });
  }
});

describe('documentIdSegmentSchema', () => {
  it('accepts ids the platform mints: auto ids, uuids, deterministic hashes', () => {
    for (const id of ['4f3Yx0aB9kQ2LmN8pRsT', '3f2504e0-4f89-11d3-9a0c-0305e82c3301', 'a'.repeat(64)]) {
      expect(documentIdSegmentSchema.safeParse(id).success).toBe(true);
    }
  });

  it('refuses an id longer than Firestore allows, counted in UTF-8 bytes', () => {
    expect(documentIdSegmentSchema.safeParse('a'.repeat(FIRESTORE_DOCUMENT_ID_MAX_BYTES)).success).toBe(true);
    expect(documentIdSegmentSchema.safeParse('a'.repeat(FIRESTORE_DOCUMENT_ID_MAX_BYTES + 1)).success).toBe(false);
    expect(documentIdSegmentSchema.safeParse('é'.repeat(FIRESTORE_DOCUMENT_ID_MAX_BYTES / 2 + 1)).success).toBe(false);
  });

  it('keeps a chained bound on top of the segment rules', () => {
    const capped = documentIdSegmentSchema.max(8);
    expect(capped.safeParse('12345678').success).toBe(true);
    expect(capped.safeParse('123456789').success).toBe(false);
    expect(capped.safeParse('12/456').success).toBe(false);
  });
});

describe('report target ids', () => {
  it('takes a chat message sequence number or a document id as the item id', () => {
    expect(reportTargetItemIdSchema.safeParse('42').success).toBe(true);
    expect(reportTargetItemIdSchema.safeParse('post-9').success).toBe(true);
    expect(reportTargetItemIdSchema.safeParse('post/9').success).toBe(false);
  });

  it('takes a parent of one id, or of two ids joined by "/" (a chat channel or a conversation file scope)', () => {
    expect(reportTargetParentRefSchema.safeParse('hall-1').success).toBe(true);
    expect(reportTargetParentRefSchema.safeParse('workProject-1/channel-2').success).toBe(true);
    expect(reportTargetParentRefSchema.safeParse('guildInvite/invite-3').success).toBe(true);
  });

  it('refuses a parent that reaches deeper than two ids or names an empty or dotted segment', () => {
    for (const parent of ['a/b/c', 'a//b', '/a', 'a/', 'a/..', '../a']) {
      expect(reportTargetParentRefSchema.safeParse(parent).success, parent).toBe(false);
    }
  });
});

describe('follow targets', () => {
  it('refuses a target id that is not one segment, so the follow edge path cannot be redirected', () => {
    for (const schema of [FollowTargetInputSchema, UnfollowTargetInputSchema]) {
      expect(schema.safeParse({ targetType: 'workProject', targetId: 'work-1' }).success).toBe(true);
      expect(schema.safeParse({ targetType: 'workProject', targetId: 'work-1/other' }).success).toBe(false);
      expect(schema.safeParse({ targetType: 'user', targetId: '..' }).success).toBe(false);
    }
  });
});
