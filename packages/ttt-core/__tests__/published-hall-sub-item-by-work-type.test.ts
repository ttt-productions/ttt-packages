import { describe, it, expect } from 'vitest';
import * as root from '../src/index';
import { PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE } from '../src/utils/hall-content';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import { WORK_PROJECT_TYPE_KEYS } from '../src/types/content';

// A writer takes a published Hall sub-item's subcollection AND its schema from one entry, so each
// entry's schema must be exactly the one the registry binds to that entry's subcollection.
describe('PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE', () => {
  it('covers every work type and nothing else', () => {
    expect(Object.keys(PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE).sort()).toEqual([...WORK_PROJECT_TYPE_KEYS].sort());
  });

  it("binds each work type's subcollection to the very schema the registry stores there", () => {
    for (const { subcollection, schema } of Object.values(PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE)) {
      const template = `hallItems/{hallItemId}/${subcollection}/{itemId}` as keyof typeof COLLECTION_SCHEMAS;
      expect(COLLECTION_SCHEMAS[template]).toBe(schema);
    }
  });

  it('gives every work type its own subcollection', () => {
    const subcollections = Object.values(PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE).map((entry) => entry.subcollection);
    expect(new Set(subcollections).size).toBe(subcollections.length);
  });

  it('is exported from the package root, where the write guard reads core maps', () => {
    expect(root.PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE).toBe(PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE);
  });
});
