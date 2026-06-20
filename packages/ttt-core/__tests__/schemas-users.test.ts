import { describe, it, expect } from 'vitest';
import {
  BecomeArtisanCreatorInputSchema,
  MarkNonUsArtisanInterestInputSchema,
} from '../src/schemas/users';

describe('BecomeArtisanCreatorInputSchema (18+ AND U.S.-person attestation)', () => {
  it('accepts both attestations true', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true }).success).toBe(true);
  });

  it('rejects when usPersonAttested is missing', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true }).success).toBe(false);
  });

  it('rejects when ageAttested is missing', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ usPersonAttested: true }).success).toBe(false);
  });

  it('rejects the old empty input', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects ageAttested: false / usPersonAttested: false', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: false, usPersonAttested: true }).success).toBe(false);
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: false }).success).toBe(false);
  });

  it('rejects a truthy non-boolean attestation', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: 'true', usPersonAttested: true }).success).toBe(false);
  });

  it('rejects unknown extra fields (schema is .strict())', () => {
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, usPersonAttested: true, extra: 1 }).success,
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
