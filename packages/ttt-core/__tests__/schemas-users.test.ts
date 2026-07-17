import { describe, it, expect } from 'vitest';
import {
  BecomeArtisanCreatorInputSchema,
  MarkNonUsArtisanInterestInputSchema,
  LookupUserByEmailOrUidInputSchema,
} from '../src/schemas/users';
import { MAX_USER_SEARCH_QUERY_LENGTH } from '../src/constants/business';

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

describe('LookupUserByEmailOrUidInputSchema (admin exact-account lookup)', () => {
  it('accepts a single trimmed query and strips surrounding whitespace', () => {
    const parsed = LookupUserByEmailOrUidInputSchema.parse({ query: '  someone@example.com  ' });
    expect(parsed).toEqual({ query: 'someone@example.com' });
  });

  it('accepts a uid- or display-name-shaped query (one field detects all three app-side)', () => {
    expect(LookupUserByEmailOrUidInputSchema.safeParse({ query: 'kZ8fW2uid' }).success).toBe(true);
    expect(LookupUserByEmailOrUidInputSchema.safeParse({ query: 'SomeName' }).success).toBe(true);
  });

  it('rejects a missing/empty query', () => {
    expect(LookupUserByEmailOrUidInputSchema.safeParse({}).success).toBe(false);
    expect(LookupUserByEmailOrUidInputSchema.safeParse({ query: '' }).success).toBe(false);
    expect(LookupUserByEmailOrUidInputSchema.safeParse({ query: '   ' }).success).toBe(false);
  });

  it('enforces the shared MAX_USER_SEARCH_QUERY_LENGTH bound', () => {
    expect(
      LookupUserByEmailOrUidInputSchema.safeParse({ query: 'a'.repeat(MAX_USER_SEARCH_QUERY_LENGTH) }).success,
    ).toBe(true);
    expect(
      LookupUserByEmailOrUidInputSchema.safeParse({ query: 'a'.repeat(MAX_USER_SEARCH_QUERY_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('rejects unknown extra fields (schema is .strict())', () => {
    expect(LookupUserByEmailOrUidInputSchema.safeParse({ query: 'x', extra: 1 }).success).toBe(false);
  });
});
