import { describe, it, expect } from 'vitest';
import { isRejectedMediaAppealOpen } from '../src/constants/retention';
import * as constants from '../src/constants/index';

describe('the appeal window', () => {
  it('is exported from the constants entry', () => {
    expect(constants.isRejectedMediaAppealOpen).toBe(isRejectedMediaAppealOpen);
  });
});
