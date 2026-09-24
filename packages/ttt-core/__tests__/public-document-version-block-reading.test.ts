import { describe, it, expect } from 'vitest';
import { AppConfigSchema } from '../src/doc-schemas/system';
import { readPublicDocumentVersionBlock, type PublicDocumentVersionBlockReading } from '../src/utils/app-config';
import {
  planPublicDocumentRelease,
  requiredPublicDocumentAcceptanceLevel,
  requiredPublicDocumentAcceptanceLevelOfReading,
} from '../src/utils/public-documents';
import { SPECIAL_DOCS } from '../src/paths/collections';
import * as root from '../src/index';
import * as utils from '../src/utils';

const TERMS = SPECIAL_DOCS.TERMS_PAGE;
const RULES = SPECIAL_DOCS.RULES_AND_AGREEMENTS;

// Terms released twice requiring acceptance, then Rules once without: level 2.
const firstRelease = planPublicDocumentRelease(undefined, [TERMS], true).block;
const secondRelease = planPublicDocumentRelease(firstRelease, [TERMS], true).block;
const block = planPublicDocumentRelease(secondRelease, [RULES], false).block;

// Every shape AppConfigSchema's field refuses for a PRESENT block.
const REFUSED_BLOCKS: ReadonlyArray<readonly [string, unknown]> = [
  ['null', null],
  ['a number', 3],
  ['a string', 'v1'],
  ['a boolean', true],
  ['an array', [block]],
  ['an empty object', {}],
  ['a block missing its level', { documents: {} }],
  ['a block missing its documents', { requiredAcceptanceLevel: 0 }],
  ['a negative level', { documents: {}, requiredAcceptanceLevel: -1 }],
  ['a fractional level', { documents: {}, requiredAcceptanceLevel: 1.5 }],
  ['a string level', { documents: {}, requiredAcceptanceLevel: '1' }],
  ['a NaN level', { documents: {}, requiredAcceptanceLevel: Number.NaN }],
  ['an unknown top-level field', { ...block, strayField: true }],
  ['documents as an array', { documents: [], requiredAcceptanceLevel: 0 }],
  [
    'an unknown document id',
    { documents: { notADocument: { currentVersion: 1, requiredVersion: 0 } }, requiredAcceptanceLevel: 0 },
  ],
  ['a document at version 0', { documents: { [TERMS]: { currentVersion: 0, requiredVersion: 0 } }, requiredAcceptanceLevel: 0 }],
  [
    'a required version above the current one',
    { documents: { [TERMS]: { currentVersion: 1, requiredVersion: 2 } }, requiredAcceptanceLevel: 1 },
  ],
  ['a document entry missing its required version', { documents: { [TERMS]: { currentVersion: 1 } }, requiredAcceptanceLevel: 0 }],
  [
    'a document entry with an unknown field',
    { documents: { [TERMS]: { currentVersion: 1, requiredVersion: 0, note: 'x' } }, requiredAcceptanceLevel: 0 },
  ],
  ['a document entry that is null', { documents: { [TERMS]: null }, requiredAcceptanceLevel: 0 }],
];

describe('readPublicDocumentVersionBlock — the one reader of the release-owned version block', () => {
  it.each<[string, Readonly<Record<string, unknown>> | null | undefined]>([
    ['a missing doc (null)', null],
    ['a doc not yet read (undefined)', undefined],
    ['an empty doc', {}],
    ['a doc holding only levers', { maintenanceMode: true, appVersion: '2.1.0' }],
    ['a doc whose block field is undefined', { publicDocumentVersions: undefined }],
  ])('reads %s as absent — nothing released', (_label, snapshot) => {
    expect(readPublicDocumentVersionBlock(snapshot)).toEqual({ status: 'absent', block: undefined });
  });

  it('reads a stored block as valid, parsed', () => {
    expect(readPublicDocumentVersionBlock({ publicDocumentVersions: block })).toEqual({ status: 'valid', block });
  });

  it('reads the empty block a fresh release system could hold as valid, not absent', () => {
    const empty = { documents: {}, requiredAcceptanceLevel: 0 };
    expect(readPublicDocumentVersionBlock({ publicDocumentVersions: empty })).toEqual({ status: 'valid', block: empty });
  });

  it('judges the block alone — a refused lever beside it does not touch it', () => {
    const reading = readPublicDocumentVersionBlock({ maintenanceMode: 'yes', publicDocumentVersions: block });
    expect(reading.status).toBe('valid');
  });

  it.each(REFUSED_BLOCKS)('reports %s as invalid, carrying no block', (_label, stored) => {
    const reading = readPublicDocumentVersionBlock({ publicDocumentVersions: stored });
    expect(reading.status).toBe('invalid');
    expect(reading).not.toHaveProperty('block');
    expect(reading.status === 'invalid' && reading.issue).toMatch(/^publicDocumentVersions/);
  });

  it('names the nested field it refused', () => {
    const reading = readPublicDocumentVersionBlock({
      publicDocumentVersions: { documents: { [TERMS]: { currentVersion: 1, requiredVersion: -1 } }, requiredAcceptanceLevel: 0 },
    });
    expect(reading.status === 'invalid' && reading.issue).toMatch(
      new RegExp(`^publicDocumentVersions\\.documents\\.${TERMS}\\.requiredVersion: `),
    );
  });

  it('agrees with AppConfigSchema: a present block is valid exactly when the schema field accepts it', () => {
    for (const [label, stored] of [...REFUSED_BLOCKS, ['a released block', block] as const]) {
      const accepted = AppConfigSchema.shape.publicDocumentVersions.safeParse(stored).success;
      expect(readPublicDocumentVersionBlock({ publicDocumentVersions: stored }).status, label).toBe(
        accepted ? 'valid' : 'invalid',
      );
    }
  });

  it.each<[string, unknown]>([
    ['a number', 5],
    ['a string', 'publicDocumentVersions'],
    ['a boolean', true],
    ['an array', [block]],
    ['a function', () => ({ publicDocumentVersions: block })],
    ['an object with no prototype', Object.create(null)],
    ['a block whose documents refer to themselves', (() => {
      const documents: Record<string, unknown> = {};
      documents[TERMS] = documents;
      return { publicDocumentVersions: { documents, requiredAcceptanceLevel: 0 } };
    })()],
    ['a block that refers to itself', (() => {
      const self: Record<string, unknown> = { requiredAcceptanceLevel: 0 };
      self.documents = self;
      return { publicDocumentVersions: self };
    })()],
  ])('never throws on %s', (_label, junk) => {
    expect(() => readPublicDocumentVersionBlock(junk as Record<string, unknown>)).not.toThrow();
  });

  it('never mutates the snapshot', () => {
    const snapshot = { publicDocumentVersions: { ...block, strayField: 1 } };
    const before = JSON.stringify(snapshot);
    readPublicDocumentVersionBlock(snapshot);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('is exported from the package root and the utils subpath', () => {
    expect(root.readPublicDocumentVersionBlock).toBe(readPublicDocumentVersionBlock);
    expect(utils.readPublicDocumentVersionBlock).toBe(readPublicDocumentVersionBlock);
  });
});

describe('requiredPublicDocumentAcceptanceLevelOfReading — the level each reading states', () => {
  const read = (stored: unknown): PublicDocumentVersionBlockReading =>
    readPublicDocumentVersionBlock(stored === undefined ? {} : { publicDocumentVersions: stored });

  it('is 0 for an absent block — nothing released requires nothing', () => {
    expect(requiredPublicDocumentAcceptanceLevelOfReading(read(undefined))).toBe(0);
    expect(requiredPublicDocumentAcceptanceLevelOfReading(readPublicDocumentVersionBlock(null))).toBe(0);
  });

  it("is a valid block's level — the same value requiredPublicDocumentAcceptanceLevel derives", () => {
    expect(requiredPublicDocumentAcceptanceLevelOfReading(read(block))).toBe(2);
    expect(requiredPublicDocumentAcceptanceLevelOfReading(read(block))).toBe(requiredPublicDocumentAcceptanceLevel(block));
  });

  it('is 0 for a valid block whose releases never required acceptance', () => {
    const unrequired = planPublicDocumentRelease(undefined, [RULES], false).block;
    expect(requiredPublicDocumentAcceptanceLevelOfReading(read(unrequired))).toBe(0);
  });

  it.each(REFUSED_BLOCKS)('is null for %s — an invalid block states no level', (_label, stored) => {
    expect(requiredPublicDocumentAcceptanceLevelOfReading(read(stored))).toBeNull();
  });

  it('is null even when the invalid block carries a readable level', () => {
    expect(requiredPublicDocumentAcceptanceLevelOfReading(read({ ...block, strayField: true }))).toBeNull();
  });

  it('is exported from the package root and the utils subpath', () => {
    expect(root.requiredPublicDocumentAcceptanceLevelOfReading).toBe(requiredPublicDocumentAcceptanceLevelOfReading);
    expect(utils.requiredPublicDocumentAcceptanceLevelOfReading).toBe(requiredPublicDocumentAcceptanceLevelOfReading);
  });
});
