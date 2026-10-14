// The write guard's own tests over the second fixture core (`./fixture-core-b`): a core whose
// registry routes one family of documents through per-kind subcollections — a builder taking the
// subcollection as an argument, a builder mapping a kind to its subcollection, a map of path
// builders per kind, field maps whose values are keys or lists of keys, and one canonical schema
// per kind. Every snippet writes against that structure.

import { describe, it, expect, beforeAll } from 'vitest';
import { createGuardProfile, loadRegistry, runGuardOnSources, VIOLATION_KINDS } from '../src/index.js';

const FIXTURE_SOURCES = Object.freeze({
  core: () => import('./fixture-core-b/index.js'),
  docSchemas: () => import('./fixture-core-b/doc-schemas.js'),
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

const PROFILE = createGuardProfile({ corePackage: '@fixture/core-b', importAliases: { '@/': 'src/' } });

let registry;
beforeAll(async () => {
  registry = await loadRegistry({ sources: FIXTURE_SOURCES, constantMapNames: FIXTURE_CONSTANT_MAPS });
});

/** Analyze one fixture file and return its violations. */
function analyze(source, { exceptions = [] } = {}) {
  return runGuardOnSources({ sources: { 'fixture/writer.ts': source }, registry, profile: PROFILE, exceptions });
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
  const publish = (extra) => `${PREAMBLE}
    import {
      HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE,
      PublishedChapterSchema,
      PublishedTuneTrackSchema,
      PublishedTelevisionEpisodeSchema,
    } from '@fixture/core-b';
    function buildSubItem(workProjectType: string, carried: unknown) {
      switch (workProjectType) {
        case 'Tales':
          return { data: PublishedChapterSchema.parse(carried) };
        case 'Tunes':
          return { data: PublishedTuneTrackSchema.parse(carried) };
        default:
          return { data: PublishedTelevisionEpisodeSchema.parse(carried) };
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
      const built = buildSubItem(workProjectType, carried);
      tx.set(ref, ${extra});
    }
  `;

  it('pairs each candidate template with the canonical schema whose parse produced the payload', () => {
    // The path and the payload are the SAME choice made twice. Diffing the union of all
    // three branches' keys against all three templates would report `content` as undeclared
    // on a tune — and the only way to satisfy that would be to unroll the discrimination,
    // which is the defect the guard exists to prevent.
    const result = analyze(publish('built.data'));
    expect(result.violations).toEqual([]);
  });

  it('still fires when the payload is NOT purely those parse outputs', () => {
    const result = analyze(publish("{ ...built.data, pairingUndeclared: 1 }"));
    expect(detailsOf(result)).toContain('pairingUndeclared');
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
