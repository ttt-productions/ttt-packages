import { describe, it, expect } from 'vitest';
import {
  BecomeArtisanCreatorInputSchema,
  MarkNonUsArtisanInterestInputSchema,
} from '../src/schemas/users';

describe('BecomeArtisanCreatorInputSchema (18+ AND U.S.-person attestation + DOB)', () => {
  const dob = { year: 1990, month: 5, day: 17 };

  it('accepts both attestations true with a valid dob', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true, dob }).success).toBe(true);
  });

  it('rejects when dob is missing (the artisan DOB is the only persisted DOB in the system)', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true }).success).toBe(false);
  });

  it('rejects an out-of-range dob month/day and a non-integer year', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true, dob: { year: 1990, month: 13, day: 1 } }).success).toBe(false);
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true, dob: { year: 1990, month: 1, day: 32 } }).success).toBe(false);
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true, dob: { year: 1990.5, month: 1, day: 1 } }).success).toBe(false);
  });

  it('rejects extra fields inside dob (dob is .strict())', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true, dob: { ...dob, extra: 1 } }).success).toBe(false);
  });

  it('rejects when usPersonAttested is missing', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, dob }).success).toBe(false);
  });

  it('rejects when ageAttested is missing', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ usPersonAttested: true, dob }).success).toBe(false);
  });

  it('rejects the old empty input', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects ageAttested: false / usPersonAttested: false', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: false, usPersonAttested: true, dob }).success).toBe(false);
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: false, dob }).success).toBe(false);
  });

  it('rejects a truthy non-boolean attestation', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: 'true', usPersonAttested: true, dob }).success).toBe(false);
  });

  it('rejects unknown extra fields (schema is .strict())', () => {
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true, dob, extra: 1 }).success,
    ).toBe(false);
  });
});

describe('MarkNonUsArtisanInterestInputSchema (non-U.S. artisan waitlist signup)', () => {
  it('accepts a country (+ optional region)', () => {
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({ country: 'Canada' }).success).toBe(true);
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({ country: 'Canada', region: 'Ontario' }).success).toBe(true);
  });

  it('rejects a missing/empty country', () => {
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({}).success).toBe(false);
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({ country: '' }).success).toBe(false);
  });

  it('rejects unknown extra fields (schema is .strict())', () => {
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({ country: 'Canada', extra: 1 }).success).toBe(false);
  });
});
