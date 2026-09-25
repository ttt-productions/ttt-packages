import { describe, it, expect } from 'vitest';
import { HALL_SUB_ITEM_TYPE_BY_WORK_TYPE } from '../src/paths/collections';
import { HallSubItemTypeSchema } from '../src/doc-schemas/content';
import { WORK_PROJECT_TYPE_KEYS } from '../src/types/content';

describe('HALL_SUB_ITEM_TYPE_BY_WORK_TYPE', () => {
  it('covers every work type and nothing else', () => {
    expect(Object.keys(HALL_SUB_ITEM_TYPE_BY_WORK_TYPE).sort()).toEqual([...WORK_PROJECT_TYPE_KEYS].sort());
  });

  it('maps onto exactly the HallSubItemType members, one work type each', () => {
    expect(Object.values(HALL_SUB_ITEM_TYPE_BY_WORK_TYPE).sort()).toEqual([...HallSubItemTypeSchema.options].sort());
  });

  it('pairs each work type with its own sub-item kind', () => {
    expect(HALL_SUB_ITEM_TYPE_BY_WORK_TYPE).toEqual({ Tales: 'chapter', Tunes: 'track', Television: 'episode' });
  });
});
