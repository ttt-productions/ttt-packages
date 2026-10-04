import { describe, expect, it } from 'vitest';
import { COLLECTION_SCHEMAS, UserPrivateDataSchema } from '../src/doc-schemas/index';

// Every Craft publish and every Craft delete writes the owner's Craft change marker inside its
// transaction, so two publishes that both counted a free slot write the same document and
// conflict instead of both landing (BACKEND-116). The field lives on the owner's server-written
// private doc, which the registry already binds.
describe('Craft change marker on the private user doc', () => {
  const base = {
    email: 'artisan@example.com',
    accountType: 'adult' as const,
    is18Plus: true,
    agePolicyVersion: '2026-06-19.general-audience.v1',
    accountCapabilityVersion: 0,
    ageAttestedAt: 1_700_000_000_000,
  };

  it('is a declared field of the registered privateData doc, so a writer may store it', () => {
    expect(Object.keys(UserPrivateDataSchema.shape)).toContain('craftSkillChangeMarker');
    expect(COLLECTION_SCHEMAS['userProfiles/{userId}/privateData/{userId}']).toBe(UserPrivateDataSchema);
  });

  it('keeps a whole, non-negative marker through the parse', () => {
    const parsed = UserPrivateDataSchema.parse({ ...base, craftSkillChangeMarker: 3 });
    expect(parsed.craftSkillChangeMarker).toBe(3);
  });

  it('is absent until the first Craft change', () => {
    expect(UserPrivateDataSchema.parse(base).craftSkillChangeMarker).toBeUndefined();
  });

  it('refuses a negative or fractional marker', () => {
    expect(UserPrivateDataSchema.safeParse({ ...base, craftSkillChangeMarker: -1 }).success).toBe(false);
    expect(UserPrivateDataSchema.safeParse({ ...base, craftSkillChangeMarker: 1.5 }).success).toBe(false);
  });
});
