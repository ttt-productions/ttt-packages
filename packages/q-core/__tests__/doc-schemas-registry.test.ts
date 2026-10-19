import { describe, it, expect } from 'vitest';
import {
  COLLECTIONS,
  SPORT_GAME_SUBCOLLECTIONS,
  SPECIAL_DOCS,
  USER_PROFILE_SUBCOLLECTIONS,
  WAIVER_TEMPLATE_SUBCOLLECTIONS,
} from '../src/paths/collections.js';
import {
  COLLECTION_DOC_ID_FIELDS,
  COLLECTION_SCHEMAS,
  PENDING_COLLECTIONS,
} from '../src/doc-schemas/registry.js';

const allCollectionNames = [
  ...Object.values(COLLECTIONS),
  ...Object.values(USER_PROFILE_SUBCOLLECTIONS),
  ...Object.values(SPORT_GAME_SUBCOLLECTIONS),
  ...Object.values(WAIVER_TEMPLATE_SUBCOLLECTIONS),
];

const boundSegments = new Set<string>();
for (const key of Object.keys(COLLECTION_SCHEMAS)) {
  for (const seg of key.split('/')) {
    if (!seg.startsWith('{')) boundSegments.add(seg);
  }
}
const pending = new Set<string>(PENDING_COLLECTIONS);

describe('Firestore collection schema registry', () => {
  it('binds or explicitly defers every known collection (no silent gaps)', () => {
    const uncovered = allCollectionNames.filter(
      (name) => !boundSegments.has(name) && !pending.has(name),
    );
    expect(uncovered).toEqual([]);
  });

  it('binds every fixed-ID document', () => {
    const unbound = Object.values(SPECIAL_DOCS).filter((docId) => !boundSegments.has(docId));
    expect(unbound).toEqual([]);
  });

  it('has no stale PENDING entries (each names a real collection that is NOT bound)', () => {
    const known = new Set<string>(allCollectionNames);
    expect([...PENDING_COLLECTIONS].filter((name) => !known.has(name))).toEqual([]);
    expect([...PENDING_COLLECTIONS].filter((name) => boundSegments.has(name))).toEqual([]);
  });

  it('every registry path is rooted in a declared collection', () => {
    const roots = new Set<string>(Object.values(COLLECTIONS));
    const strays = Object.keys(COLLECTION_SCHEMAS).filter((path) => !roots.has(path.split('/')[0]));
    expect(strays).toEqual([]);
  });

  it('binds every registry path to a parseable Zod schema', () => {
    for (const schema of Object.values(COLLECTION_SCHEMAS)) {
      expect(typeof schema.safeParse).toBe('function');
    }
  });

  it('annotates doc-id fields only on registered paths, each a field its schema declares', () => {
    type ShapedSchema = { shape?: Record<string, unknown>; options?: ShapedSchema[] };
    for (const [path, field] of Object.entries(COLLECTION_DOC_ID_FIELDS)) {
      const schema = (COLLECTION_SCHEMAS as unknown as Record<string, ShapedSchema>)[path];
      expect(schema, `${path} must be a registered collection`).toBeDefined();
      // A union schema declares the field only when every one of its document shapes does.
      const shapes = schema.options ?? [schema];
      expect(
        shapes.every((shape) => shape.shape?.[field] !== undefined),
        `${path} must declare '${field}'`,
      ).toBe(true);
    }
  });
});
