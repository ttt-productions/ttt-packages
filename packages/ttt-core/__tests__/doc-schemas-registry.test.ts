import { describe, it, expect } from 'vitest';
import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  WORK_PROJECT_SUBCOLLECTIONS,
  WORK_REALM_SUBCOLLECTIONS,
  HALL_ITEM_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
} from '../src/paths/collections';
import { COLLECTION_SCHEMAS, PENDING_COLLECTIONS, COLLECTION_DOC_ID_FIELDS } from '../src/doc-schemas/registry';

const allCollectionNames = [
  ...Object.values(COLLECTIONS),
  ...Object.values(USER_SUBCOLLECTIONS),
  ...Object.values(WORK_PROJECT_SUBCOLLECTIONS),
  ...Object.values(WORK_REALM_SUBCOLLECTIONS),
  ...Object.values(HALL_ITEM_SUBCOLLECTIONS),
  ...Object.values(NESTED_SUBCOLLECTIONS),
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

  it('has no stale PENDING entries (each names a real collection)', () => {
    const known = new Set<string>(allCollectionNames);
    const stale = [...PENDING_COLLECTIONS].filter((name) => !known.has(name));
    expect(stale).toEqual([]);
  });

  it('binds every registry path to a parseable Zod schema', () => {
    for (const schema of Object.values(COLLECTION_SCHEMAS)) {
      expect(typeof schema.safeParse).toBe('function');
    }
  });

  it('closes the recon gap — auditEvents is now in the registry', () => {
    expect(boundSegments.has('auditEvents')).toBe(true);
  });
});

type ShapedSchema = { shape?: Record<string, unknown>; options?: readonly ShapedSchema[] };

/** The object shape(s) a binding validates against: its own, or every branch of a union. */
function boundShapes(schema: ShapedSchema): Record<string, unknown>[] | null {
  if (schema.shape) return [schema.shape];
  if (!schema.options?.length) return null;
  const shapes = schema.options.map((option) => option.shape);
  return shapes.every((shape) => shape !== undefined) ? (shapes as Record<string, unknown>[]) : null;
}

describe('Doc-id field annotations (COLLECTION_DOC_ID_FIELDS)', () => {
  it('annotates only registered paths, each with a field the bound schema actually declares', () => {
    for (const [path, field] of Object.entries(COLLECTION_DOC_ID_FIELDS)) {
      const schema = (COLLECTION_SCHEMAS as Record<string, ShapedSchema>)[path];
      expect(schema, `${path} must be a registered collection`).toBeDefined();
      // Every annotated binding is a ZodObject, or a union of ZodObjects, whose every shape
      // includes the doc-id field; the drift-check injects doc.id under this key before
      // validating, so whichever branch a stored doc matches must declare it.
      const shapes = boundShapes(schema);
      expect(shapes, `${path} must be a ZodObject or a union of ZodObjects`).not.toBeNull();
      for (const shape of shapes ?? []) {
        expect(Object.keys(shape), `${path}: doc-id field "${field}" must exist on the bound schema`).toContain(
          field,
        );
      }
    }
  });

  it('checks every branch of a union binding', () => {
    const union = COLLECTION_SCHEMAS['statusReconcileQueue/{uid}'] as ShapedSchema;
    expect(union.shape).toBeUndefined();
    expect(boundShapes(union)).toHaveLength(2);
    expect(boundShapes({ options: [{ shape: { uid: 1 } }, {}] })).toBeNull();
  });
});
