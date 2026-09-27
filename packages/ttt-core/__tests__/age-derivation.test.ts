import { describe, it, expect } from 'vitest';
import { ageInWholeYears, deriveAgeBracket } from '../src/utils/age-derivation';
import {
  AGE_ADULT_FLOOR_YEARS,
  AGE_TEEN_FLOOR_YEARS,
  DATE_OF_BIRTH_MIN_YEAR,
} from '../src/constants/business-user';
import {
  BecomeArtisanCreatorInputSchema,
  DateOfBirthSchema,
  DateOfBirthShapeSchema,
  UpgradeAccountToAdultInputSchema,
} from '../src/schemas/users';
import * as root from '../src/index';

const asOf = new Date(Date.UTC(2030, 5, 15, 12)); // 15 June 2030, midday UTC

describe('the age floors', () => {
  it('are 13 for any account and 18 for an adult one', () => {
    expect(AGE_TEEN_FLOOR_YEARS).toBe(13);
    expect(AGE_ADULT_FLOOR_YEARS).toBe(18);
    expect(DATE_OF_BIRTH_MIN_YEAR).toBe(1900);
  });
});

describe('ageInWholeYears', () => {
  it('counts a birthday from its own day on the UTC calendar', () => {
    expect(ageInWholeYears({ year: 2012, month: 6, day: 15 }, asOf)).toBe(18);
    expect(ageInWholeYears({ year: 2012, month: 6, day: 16 }, asOf)).toBe(17);
    expect(ageInWholeYears({ year: 2012, month: 7, day: 1 }, asOf)).toBe(17);
    expect(ageInWholeYears({ year: 2012, month: 5, day: 31 }, asOf)).toBe(18);
  });
});

describe('deriveAgeBracket', () => {
  it('is adult from the 18th birthday, teen the day before', () => {
    expect(deriveAgeBracket({ year: 2012, month: 6, day: 15 }, asOf)).toEqual({ kind: 'eligible', bracket: 'adult' });
    expect(deriveAgeBracket({ year: 2012, month: 6, day: 16 }, asOf)).toEqual({ kind: 'eligible', bracket: 'teen' });
  });

  it('is teen from the 13th birthday, under 13 the day before', () => {
    expect(deriveAgeBracket({ year: 2017, month: 6, day: 15 }, asOf)).toEqual({ kind: 'eligible', bracket: 'teen' });
    expect(deriveAgeBracket({ year: 2017, month: 6, day: 16 }, asOf)).toEqual({ kind: 'under13' });
  });

  it('turns on the UTC day, not the local one', () => {
    const justBeforeUtcMidnight = new Date(Date.UTC(2030, 5, 14, 23, 59, 59));
    expect(deriveAgeBracket({ year: 2012, month: 6, day: 15 }, justBeforeUtcMidnight)).toEqual({
      kind: 'eligible',
      bracket: 'teen',
    });
  });

  it('handles a leap-day birthday: 18 only once 1 March has come in a common year', () => {
    const feb28 = new Date(Date.UTC(2030, 1, 28));
    const mar1 = new Date(Date.UTC(2030, 2, 1));
    expect(deriveAgeBracket({ year: 2012, month: 2, day: 29 }, feb28)).toEqual({ kind: 'eligible', bracket: 'teen' });
    expect(deriveAgeBracket({ year: 2012, month: 2, day: 29 }, mar1)).toEqual({ kind: 'eligible', bracket: 'adult' });
  });

  it('refuses a date that is not a real date of birth', () => {
    for (const dob of [
      { year: 2000, month: 2, day: 30 }, // impossible calendar date
      { year: 2001, month: 2, day: 29 }, // not a leap year
      { year: 2000, month: 13, day: 1 },
      { year: 2000, month: 0, day: 1 },
      { year: 2000, month: 1, day: 0 },
      { year: 2000, month: 1, day: 32 },
      { year: 1899, month: 12, day: 31 }, // before the earliest birth year
      { year: 2030, month: 6, day: 16 }, // after the day it is judged on
      { year: 2031, month: 1, day: 1 },
      { year: 2000.5, month: 1, day: 1 },
      { year: 2000, month: 1.5, day: 1 },
      { year: Number.NaN, month: 1, day: 1 },
    ]) {
      expect(deriveAgeBracket(dob, asOf), JSON.stringify(dob)).toEqual({ kind: 'invalid' });
    }
  });

  it('accepts the earliest birth year', () => {
    expect(deriveAgeBracket({ year: DATE_OF_BIRTH_MIN_YEAR, month: 1, day: 1 }, asOf)).toEqual({
      kind: 'eligible',
      bracket: 'adult',
    });
  });

  it('is exported from the package root', () => {
    expect(root.deriveAgeBracket).toBe(deriveAgeBracket);
  });
});

describe('DateOfBirthSchema', () => {
  it('is the one date-of-birth shape every date-of-birth input takes', () => {
    const dob = { year: 2000, month: 1, day: 31 };
    expect(DateOfBirthSchema.safeParse(dob).success).toBe(true);
    expect(DateOfBirthSchema.safeParse({ ...dob, month: 13 }).success).toBe(false);
    expect(DateOfBirthSchema.safeParse({ ...dob, extra: 1 }).success).toBe(false);
    expect(UpgradeAccountToAdultInputSchema.shape.dob).toBe(DateOfBirthSchema);
    expect(BecomeArtisanCreatorInputSchema.shape.dob).toBe(DateOfBirthSchema);
  });
});

describe('DateOfBirthShapeSchema', () => {
  it('has the same fields as DateOfBirthSchema and no bounds, so an out-of-range date reaches the derivation', () => {
    expect(Object.keys(DateOfBirthShapeSchema.shape).sort()).toEqual(Object.keys(DateOfBirthSchema.shape).sort());
    expect(DateOfBirthShapeSchema.safeParse({ year: 2000, month: 13, day: 40 }).success).toBe(true);
    expect(DateOfBirthShapeSchema.safeParse({ year: 2000.5, month: 1, day: 1 }).success).toBe(true);
    expect(DateOfBirthShapeSchema.safeParse({ year: '2000', month: 1, day: 1 }).success).toBe(false);
    expect(DateOfBirthShapeSchema.safeParse({ year: 2000, month: 1, day: 1, extra: 1 }).success).toBe(false);
  });
});
