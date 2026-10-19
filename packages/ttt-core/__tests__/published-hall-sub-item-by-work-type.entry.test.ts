import { describe, it, expect } from 'vitest';
import * as utils from '../src/utils/index';
import { PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE } from '../src/utils/hall-content';

describe('PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE', () => {
  it('is exported from the utils entry, where the write guard reads core maps', () => {
    expect(utils.PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE).toBe(PUBLISHED_HALL_SUB_ITEM_BY_WORK_TYPE);
  });
});
