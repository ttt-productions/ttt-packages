import { describe, it, expect } from 'vitest';
import { DATE_OF_BIRTH_MIN_YEAR, DATE_OF_BIRTH_PART_DIGITS, deriveAgeBracket } from '../src/index';
import * as constantsBarrel from '../src/constants/index';
import { DateOfBirthSchema } from '../src/schemas/index';

describe('date-of-birth part widths', () => {
  it('are two digits for the month and day and four for the year, from the root and the constants barrel', () => {
    expect(DATE_OF_BIRTH_PART_DIGITS).toEqual({ month: 2, day: 2, year: 4 });
    expect(constantsBarrel.DATE_OF_BIRTH_PART_DIGITS).toBe(DATE_OF_BIRTH_PART_DIGITS);
  });

  it('hold the largest month and day the schema accepts', () => {
    expect(DateOfBirthSchema.safeParse({ year: 2000, month: 12, day: 31 }).success).toBe(true);
    expect(DateOfBirthSchema.safeParse({ year: 2000, month: 13, day: 31 }).success).toBe(false);
    expect(DateOfBirthSchema.safeParse({ year: 2000, month: 12, day: 32 }).success).toBe(false);
    expect(String(12)).toHaveLength(DATE_OF_BIRTH_PART_DIGITS.month);
    expect(String(31)).toHaveLength(DATE_OF_BIRTH_PART_DIGITS.day);
  });

  it('hold every year from the floor year to today, and a full-width entry derives a bracket', () => {
    const asOf = new Date();
    expect(String(DATE_OF_BIRTH_MIN_YEAR)).toHaveLength(DATE_OF_BIRTH_PART_DIGITS.year);
    expect(String(asOf.getUTCFullYear())).toHaveLength(DATE_OF_BIRTH_PART_DIGITS.year);
    const typed = { month: '01', day: '01', year: String(DATE_OF_BIRTH_MIN_YEAR) };
    expect(typed.month).toHaveLength(DATE_OF_BIRTH_PART_DIGITS.month);
    expect(typed.day).toHaveLength(DATE_OF_BIRTH_PART_DIGITS.day);
    const dob = { month: Number(typed.month), day: Number(typed.day), year: Number(typed.year) };
    expect(deriveAgeBracket(dob, asOf)).toEqual({ kind: 'eligible', bracket: 'adult' });
  });
});
