import { describe, it, expect } from 'vitest';
import { DATE_OF_BIRTH_PART_DIGITS } from '../src/constants/business-user';
import * as constantsBarrel from '../src/constants/index';

describe('date-of-birth part widths', () => {
  it('are two digits for the month and day and four for the year, from the constants entry', () => {
    expect(DATE_OF_BIRTH_PART_DIGITS).toEqual({ month: 2, day: 2, year: 4 });
    expect(constantsBarrel.DATE_OF_BIRTH_PART_DIGITS).toBe(DATE_OF_BIRTH_PART_DIGITS);
  });
});
