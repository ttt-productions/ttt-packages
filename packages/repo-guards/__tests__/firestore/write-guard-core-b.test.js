// The write guard's own tests over the second fixture core (`./fixture-core-b`): a core whose
// registry routes one family of documents through per-kind subcollections — a builder taking the
// subcollection as an argument, a builder mapping a kind to its subcollection, a map of path
// builders per kind, field maps whose values are keys or lists of keys, and one canonical schema
// per kind. Every snippet writes against that structure.

import { describe, it, expect, beforeAll } from 'vitest';
import {
  createGuardProfile,
  loadRegistry,
  runGuardOnSources,
  VIOLATION_KINDS,
} from '../../src/modules/firestore/analyzer.js';
import * as fixtureCore from './fixture-core-b/index.js';
import * as fixtureDocSchemas from './fixture-core-b/doc-schemas.js';

const FIXTURE_SOURCES = Object.freeze({
  core: async () => fixtureCore,
  docSchemas: async () => fixtureDocSchemas,
  subpaths: Object.freeze({}),
});

const FIXTURE_CONSTANT_MAPS = Object.freeze([
  'COLLECTIONS',
  'COLLECTION_GROUPS',
  'NESTED_SUBCOLLECTIONS',
  'USER_SUBCOLLECTIONS',
  'WORK_PROJECT_SUBCOLLECTIONS',
  'WORK_REALM_SUBCOLLECTIONS',
  'HALL_ITEM_SUBCOLLECTIONS',
  'SPECIAL_DOCS',
]);

const PROFILE = createGuardProfile({
  corePackage: '@fixture/core-b',
  importAliases: { '@/': 'src/' },
});

let registry;
beforeAll(async () => {
  registry = await loadRegistry({
    sources: FIXTURE_SOURCES,
    constantMapNames: FIXTURE_CONSTANT_MAPS,
  });
});

/** Analyze one fixture file and return its violations. */
function analyze(source, { exceptions = [] } = {}) {
  return runGuardOnSources({
    sources: { 'fixture/writer.ts': source },
    registry,
    profile: PROFILE,
    exceptions,
  });
}

const kindsOf = (result) => result.violations.map((violation) => violation.kind);
const detailsOf = (result) => result.violations.map((violation) => violation.detail).join('\n');

/** Every fixture opens with the imports a real writer has. */
const PREAMBLE = `
import { PATH_BUILDERS, COLLECTIONS, toPath } from '@fixture/core-b';
import { FieldValue } from 'firebase-admin/firestore';
const db = getFirestore();
`;

describe('MUST FAIL — a key the document schema does not declare', () => {
  it('fires on the top-level authorityCertification the NCII requester document never declared', () => {
    // The exact write the sweep found: the canonical value lives INSIDE
    // authorizedRepresentative, and the top-level copy is not a stored field.
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, requestId: string, input: never) {
        const privateRef = db.doc(toPath(PATH_BUILDERS.takeItDownRequesterPrivate(requestId)));
        tx.create(privateRef, {
          schemaVersion: 1,
          requesterName: 'x',
          authorityCertification: true,
        });
      }
    `);
    expect(detailsOf(result)).toContain(
      "'authorityCertification' is not declared by takeItDownRequests/{requestId}/privateDetails/requester",
    );
  });

  it('keeps literal canonical-builder arguments correlated with their one target schema', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(hallItemId: string, itemId: string) {
        await db.doc(toPath(PATH_BUILDERS.hallItemType(hallItemId, 'hallItemTunes', itemId))).set(
          { content: 'a chapter cannot be written to a tune' },
          { merge: true },
        );
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain('hallItems/{hallItemId}/hallItemTunes/{itemId}');
  });
});

describe('MUST PASS — a literal canonical-builder argument', () => {
  it('uses a literal canonical-builder argument to select its exact registered schema', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(hallItemId: string, itemId: string) {
        await db.doc(toPath(PATH_BUILDERS.hallItemType(hallItemId, 'hallItemTales', itemId))).set(
          { content: 'chapter text' },
          { merge: true },
        );
      }
    `);
    expect(result.violations).toEqual([]);
  });
});

describe('computed keys drawn from a canonical core const map', () => {
  it('reads one property hop off a map entry, and every entry of an array-valued map', () => {
    const result = analyze(`
      import { PATH_BUILDERS, toPath, MODERATION_CLEARABLE_TEXT_FIELDS } from '@fixture/core-b';
      const db = getFirestore();
      export async function writeIt(hallItemId: string, itemId: string, kind: string) {
        await db.doc(toPath(PATH_BUILDERS.hallItemType(hallItemId, 'hallItemTales', itemId))).set(
          { [MODERATION_CLEARABLE_TEXT_FIELDS[kind]]: '' },
          { merge: true },
        );
      }
    `);
    expect(result.writes[0].keys).toContain('title');
    expect(result.writes[0].keys).toContain('content');
  });
});

describe('a discriminated path written with a discriminated payload', () => {
  // A target and a payload chosen by one decision are paired only where the guard can prove it.
  // One core map entry carrying each kind's subcollection AND its schema, read once by both sides,
  // is that proof: every kind becomes its own branch, its document diffed against its own schema.
  const throughOneEntry = (payload) => `${PREAMBLE}
    import { PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE } from '@fixture/core-b';
    export function writeIt(
      tx: FirebaseFirestore.Transaction,
      hallItemId: string,
      itemId: string,
      workProjectType: string,
      carried: unknown,
    ) {
      const published = PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE[workProjectType];
      const ref = db.doc(toPath(PATH_BUILDERS.hallItemType(hallItemId, published.subcollection, itemId)));
      ${payload}
    }
  `;

  it("pairs each kind's document with its own entry's schema through one map entry", () => {
    const result = analyze(throughOneEntry('tx.set(ref, published.schema.parse(carried));'));
    expect(result.violations).toEqual([]);
    expect(result.writes[0].correlatedBranches.map((branch) => branch.templates)).toEqual([
      ['hallItems/{hallItemId}/hallItemTales/{itemId}'],
      ['hallItems/{hallItemId}/hallItemTunes/{itemId}'],
      ['hallItems/{hallItemId}/hallItemTelevision/{itemId}'],
    ]);
  });

  it("pairs a safeParse result's data the same way", () => {
    const result = analyze(
      throughOneEntry(`
      const parsed = published.schema.safeParse(carried);
      if (!parsed.success) throw new Error('unpublishable');
      tx.set(ref, parsed.data);
    `),
    );
    expect(result.violations).toEqual([]);
  });

  it('MUST FAIL — still fires when the payload is NOT purely the entry schema output', () => {
    const result = analyze(
      throughOneEntry('tx.set(ref, { ...published.schema.parse(carried), pairingUndeclared: 1 });'),
    );
    expect(detailsOf(result)).toContain('pairingUndeclared');
  });

  it('MUST FAIL — the entry picks the path while a fixed schema picks the payload', () => {
    const result = analyze(`${PREAMBLE}
      import { PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE, PublishedTuneTrackSchema } from '@fixture/core-b';
      export function writeIt(tx: FirebaseFirestore.Transaction, hallItemId: string, itemId: string, workProjectType: string, carried: unknown) {
        const published = PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE[workProjectType];
        tx.set(db.doc(toPath(PATH_BUILDERS.hallItemType(hallItemId, published.subcollection, itemId))), PublishedTuneTrackSchema.parse(carried));
      }
    `);
    expect(detailsOf(result)).toContain(
      "'audioAssetId' is not declared by hallItems/{hallItemId}/hallItemTales/{itemId}",
    );
  });

  // The same choice made twice — a subcollection map on one side, a switch over the same kind on
  // the other — proves nothing: the switch could hand any kind any schema. Every candidate
  // document is diffed against every key the payload can carry.
  const twoPlaces = (cases) => `${PREAMBLE}
    import {
      HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE,
      PublishedChapterSchema,
      PublishedTuneTrackSchema,
      PublishedTelevisionEpisodeSchema,
    } from '@fixture/core-b';
    function buildSubItem(workProjectType: string, carried: unknown) {
      switch (workProjectType) {
        ${cases}
      }
    }
    export function writeIt(
      tx: FirebaseFirestore.Transaction,
      hallItemId: string,
      itemId: string,
      workProjectType: string,
      carried: unknown,
    ) {
      const subcollection = HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE[workProjectType];
      const ref = db.doc(toPath(PATH_BUILDERS.hallItemType(hallItemId, subcollection, itemId)));
      tx.set(ref, buildSubItem(workProjectType, carried).data);
    }
  `;

  it('MUST FAIL — the same selector read in two places is not a proven pairing', () => {
    const result = analyze(
      twoPlaces(`
      case 'Tales':
        return { data: PublishedChapterSchema.parse(carried) };
      case 'Tunes':
        return { data: PublishedTuneTrackSchema.parse(carried) };
      default:
        return { data: PublishedTelevisionEpisodeSchema.parse(carried) };
    `),
    );
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain("'content' is not declared by");
  });

  it("MUST FAIL — crossed branches, each kind handed another kind's schema", () => {
    const result = analyze(
      twoPlaces(`
      case 'Tales':
        return { data: PublishedTuneTrackSchema.parse(carried) };
      case 'Tunes':
        return { data: PublishedTelevisionEpisodeSchema.parse(carried) };
      default:
        return { data: PublishedChapterSchema.parse(carried) };
    `),
    );
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
  });

  it('MUST FAIL — independent selectors over the same set of documents', () => {
    const result = analyze(`${PREAMBLE}
      import {
        HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE,
        PublishedChapterSchema,
        PublishedTuneTrackSchema,
      } from '@fixture/core-b';
      export function writeIt(tx: FirebaseFirestore.Transaction, hallItemId: string, itemId: string, pathKind: string, shapeIsTale: boolean, carried: unknown) {
        const ref = db.doc(toPath(PATH_BUILDERS.hallItemType(hallItemId, HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE[pathKind], itemId)));
        tx.set(ref, shapeIsTale ? PublishedChapterSchema.parse(carried) : PublishedTuneTrackSchema.parse(carried));
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
  });
});

describe('a canonical builder that MAPS one of its arguments', () => {
  it('leaves the mapped slot unknown instead of matching no template at all', () => {
    // `PATH_BUILDERS.hallItemSubItem(id, workType, itemId)` routes the work TYPE to its Hall
    // subcollection. Probing it with a placeholder yields nothing for that slot, and a
    // literal `undefined` there would make the builder resolve to no document at all —
    // silently turning every write through it into an unresolved-target.
    const result = analyze(`${PREAMBLE}
      export async function writeIt(hallItemId: string, workProjectType: string, subItemId: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.hallItemSubItem(hallItemId, workProjectType, subItemId)));
        await ref.set({ mappedBuilderUndeclared: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('mappedBuilderUndeclared');
  });
});

describe('a canonical core map of PATH BUILDERS', () => {
  const source = (payload) => `${PREAMBLE}
    import { WORK_SECTION_PATHS_BY_TYPE } from '@fixture/core-b';
    export async function writeIt(workProjectType: string, workProjectId: string, subItemId: string) {
      const paths = WORK_SECTION_PATHS_BY_TYPE[workProjectType];
      const sectionSnap = await db.collection(toPath(paths.section(workProjectId))).get();
      const liveRef = subItemId
        ? db.doc(toPath(paths.subItem(workProjectId, sectionSnap.docs[0].id, subItemId)))
        : sectionSnap.docs[0].ref;
      await liveRef.update(${payload});
    }
  `;

  it('resolves BOTH branches — the mapped collection and the mapped document', () => {
    // `WORK_SECTION_PATHS_BY_TYPE` is the one owner of the per-work-type routing. Its
    // entries hold canonical builders, so they are invoked with sentinels exactly as
    // PATH_BUILDERS is; every work type stays a candidate.
    const result = analyze(source("{ title: 'x' }"));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('fires on an undeclared key written through it', () => {
    expect(detailsOf(analyze(source('{ coreMapBuilderUndeclared: 1 }')))).toContain(
      'coreMapBuilderUndeclared',
    );
  });
});
