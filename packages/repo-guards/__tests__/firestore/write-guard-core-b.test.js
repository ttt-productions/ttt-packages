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
  'NESTED_SUBCOLLECTIONS',
  'SHELF_SUBCOLLECTIONS',
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
  it('fires on a top-level key the requester document declares only inside a nested object', () => {
    // The canonical value lives INSIDE authorizedRepresentative; a top-level copy is not a stored
    // field.
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, requestId: string, input: never) {
        const privateRef = db.doc(toPath(PATH_BUILDERS.accessRequesterPrivate(requestId)));
        tx.create(privateRef, {
          schemaVersion: 1,
          requesterName: 'x',
          authorityCertification: true,
        });
      }
    `);
    expect(detailsOf(result)).toContain(
      "'authorityCertification' is not declared by accessRequests/{requestId}/privateDetails/requester",
    );
  });

  it('keeps literal canonical-builder arguments correlated with their one target schema', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(shelfId: string, itemId: string) {
        await db.doc(toPath(PATH_BUILDERS.shelfItemType(shelfId, 'shelfAlbums', itemId))).set(
          { content: 'a book text cannot be written to an album' },
          { merge: true },
        );
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain('shelves/{shelfId}/shelfAlbums/{itemId}');
  });
});

describe('MUST PASS — a literal canonical-builder argument', () => {
  it('uses a literal canonical-builder argument to select its exact registered schema', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(shelfId: string, itemId: string) {
        await db.doc(toPath(PATH_BUILDERS.shelfItemType(shelfId, 'shelfBooks', itemId))).set(
          { content: 'book text' },
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
      import { PATH_BUILDERS, toPath, CLEARABLE_TEXT_FIELDS } from '@fixture/core-b';
      const db = getFirestore();
      export async function writeIt(shelfId: string, itemId: string, kind: string) {
        await db.doc(toPath(PATH_BUILDERS.shelfItemType(shelfId, 'shelfBooks', itemId))).set(
          { [CLEARABLE_TEXT_FIELDS[kind]]: '' },
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
    import { PUBLISHED_SHELF_ITEM_BY_KIND } from '@fixture/core-b';
    export function writeIt(
      tx: FirebaseFirestore.Transaction,
      shelfId: string,
      itemId: string,
      kind: string,
      carried: unknown,
    ) {
      const published = PUBLISHED_SHELF_ITEM_BY_KIND[kind];
      const ref = db.doc(toPath(PATH_BUILDERS.shelfItemType(shelfId, published.subcollection, itemId)));
      ${payload}
    }
  `;

  it("pairs each kind's document with its own entry's schema through one map entry", () => {
    const result = analyze(throughOneEntry('tx.set(ref, published.schema.parse(carried));'));
    expect(result.violations).toEqual([]);
    expect(result.writes[0].correlatedBranches.map((branch) => branch.templates)).toEqual([
      ['shelves/{shelfId}/shelfBooks/{itemId}'],
      ['shelves/{shelfId}/shelfAlbums/{itemId}'],
      ['shelves/{shelfId}/shelfFilms/{itemId}'],
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
      import { PUBLISHED_SHELF_ITEM_BY_KIND, PublishedAlbumSchema } from '@fixture/core-b';
      export function writeIt(tx: FirebaseFirestore.Transaction, shelfId: string, itemId: string, kind: string, carried: unknown) {
        const published = PUBLISHED_SHELF_ITEM_BY_KIND[kind];
        tx.set(db.doc(toPath(PATH_BUILDERS.shelfItemType(shelfId, published.subcollection, itemId))), PublishedAlbumSchema.parse(carried));
      }
    `);
    expect(detailsOf(result)).toContain(
      "'audioAssetId' is not declared by shelves/{shelfId}/shelfBooks/{itemId}",
    );
  });

  // The same choice made twice — a subcollection map on one side, a switch over the same kind on
  // the other — proves nothing: the switch could hand any kind any schema. Every candidate
  // document is diffed against every key the payload can carry.
  const twoPlaces = (cases) => `${PREAMBLE}
    import {
      SHELF_SUBCOLLECTION_BY_KIND,
      PublishedBookSchema,
      PublishedAlbumSchema,
      PublishedFilmSchema,
    } from '@fixture/core-b';
    function buildSubItem(kind: string, carried: unknown) {
      switch (kind) {
        ${cases}
      }
    }
    export function writeIt(
      tx: FirebaseFirestore.Transaction,
      shelfId: string,
      itemId: string,
      kind: string,
      carried: unknown,
    ) {
      const subcollection = SHELF_SUBCOLLECTION_BY_KIND[kind];
      const ref = db.doc(toPath(PATH_BUILDERS.shelfItemType(shelfId, subcollection, itemId)));
      tx.set(ref, buildSubItem(kind, carried).data);
    }
  `;

  it('MUST FAIL — the same selector read in two places is not a proven pairing', () => {
    const result = analyze(
      twoPlaces(`
      case 'Books':
        return { data: PublishedBookSchema.parse(carried) };
      case 'Albums':
        return { data: PublishedAlbumSchema.parse(carried) };
      default:
        return { data: PublishedFilmSchema.parse(carried) };
    `),
    );
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain("'content' is not declared by");
  });

  it("MUST FAIL — crossed branches, each kind handed another kind's schema", () => {
    const result = analyze(
      twoPlaces(`
      case 'Books':
        return { data: PublishedAlbumSchema.parse(carried) };
      case 'Albums':
        return { data: PublishedFilmSchema.parse(carried) };
      default:
        return { data: PublishedBookSchema.parse(carried) };
    `),
    );
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
  });

  it('MUST FAIL — independent selectors over the same set of documents', () => {
    const result = analyze(`${PREAMBLE}
      import {
        SHELF_SUBCOLLECTION_BY_KIND,
        PublishedBookSchema,
        PublishedAlbumSchema,
      } from '@fixture/core-b';
      export function writeIt(tx: FirebaseFirestore.Transaction, shelfId: string, itemId: string, pathKind: string, shapeIsBook: boolean, carried: unknown) {
        const ref = db.doc(toPath(PATH_BUILDERS.shelfItemType(shelfId, SHELF_SUBCOLLECTION_BY_KIND[pathKind], itemId)));
        tx.set(ref, shapeIsBook ? PublishedBookSchema.parse(carried) : PublishedAlbumSchema.parse(carried));
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
  });
});

describe('a canonical builder that MAPS one of its arguments', () => {
  it('leaves the mapped slot unknown instead of matching no template at all', () => {
    // `PATH_BUILDERS.shelfSubItem(id, kind, itemId)` routes the KIND to its shelf
    // subcollection. Probing it with a placeholder yields nothing for that slot, and a
    // literal `undefined` there would make the builder resolve to no document at all —
    // silently turning every write through it into an unresolved-target.
    const result = analyze(`${PREAMBLE}
      export async function writeIt(shelfId: string, kind: string, subItemId: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.shelfSubItem(shelfId, kind, subItemId)));
        await ref.set({ mappedBuilderUndeclared: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('mappedBuilderUndeclared');
  });
});

describe('a canonical core map of PATH BUILDERS', () => {
  const source = (payload) => `${PREAMBLE}
    import { PROJECT_SECTION_PATHS_BY_KIND } from '@fixture/core-b';
    export async function writeIt(kind: string, projectId: string, subItemId: string) {
      const paths = PROJECT_SECTION_PATHS_BY_KIND[kind];
      const sectionSnap = await db.collection(toPath(paths.section(projectId))).get();
      const liveRef = subItemId
        ? db.doc(toPath(paths.subItem(projectId, sectionSnap.docs[0].id, subItemId)))
        : sectionSnap.docs[0].ref;
      await liveRef.update(${payload});
    }
  `;

  it('resolves BOTH branches — the mapped collection and the mapped document', () => {
    // `PROJECT_SECTION_PATHS_BY_KIND` is the one owner of the per-kind routing. Its
    // entries hold canonical builders, so they are invoked with sentinels exactly as
    // PATH_BUILDERS is; every kind stays a candidate.
    const result = analyze(source("{ title: 'x' }"));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('fires on an undeclared key written through it', () => {
    expect(detailsOf(analyze(source('{ coreMapBuilderUndeclared: 1 }')))).toContain(
      'coreMapBuilderUndeclared',
    );
  });
});
