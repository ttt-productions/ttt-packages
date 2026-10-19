import { describe, it, expect } from 'vitest';
import { DATE_OF_BIRTH_PART_DIGITS } from '../src/constants/business-user.js';
import * as constantsBarrel from '../src/constants/index.js';

describe('date-of-birth part widths', () => {
  it('are exported from the constants entry', () => {
    expect(constantsBarrel.DATE_OF_BIRTH_PART_DIGITS).toBe(DATE_OF_BIRTH_PART_DIGITS);
  });
});
