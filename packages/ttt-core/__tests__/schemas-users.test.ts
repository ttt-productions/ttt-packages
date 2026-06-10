import { describe, it, expect } from 'vitest';
import { BecomeArtisanCreatorInputSchema } from '../src/schemas/users';

describe('BecomeArtisanCreatorInputSchema (18+ attestation)', () => {
  it('accepts ageAttested: true', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true }).success).toBe(true);
  });

  it('rejects a missing ageAttested flag (the old empty input)', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects ageAttested: false', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: false }).success).toBe(false);
  });

  it('rejects a truthy non-boolean ageAttested', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: 'true' }).success).toBe(false);
  });

  it('rejects unknown extra fields (schema is .strict())', () => {
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({ ageAttested: true, extra: 1 }).success,
    ).toBe(false);
  });
});
