// First-visit site-tour state on `privateData/{uid}` (account-durable, server-written).
// Covers the standalone UserSiteTourStateSchema, its acceptance inside the canonical
// UserPrivateDataSchema, the strict YYYY-MM-DD notTodayDate validation, and the
// SITE_TOUR_CURRENT_VERSION cross-boundary constant.

import { describe, it, expect } from 'vitest';
import { UserSiteTourStateSchema, UserPrivateDataSchema } from '../src/doc-schemas/user';
import { SITE_TOUR_CURRENT_VERSION } from '../src/constants/business-user';

// A minimal-but-valid privateData body (the age cluster fields are required on the
// canonical schema); siteTour is layered on top per-case.
const baseAgeFields = {
  accountType: 'adult' as const,
  is18Plus: true,
  agePolicyVersion: '2026-06-19.general-audience.v1',
  accountCapabilityVersion: 0,
  ageAttestedAt: 1_700_000_000_000,
};
const basePrivateData = { email: 'someone@example.com', ...baseAgeFields };

describe('UserSiteTourStateSchema', () => {
  it('accepts an empty object (a member who has never handled the tour has no field at all)', () => {
    expect(UserSiteTourStateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a fully populated valid shape', () => {
    expect(
      UserSiteTourStateSchema.safeParse({
        completedVersion: SITE_TOUR_CURRENT_VERSION,
        completedAt: 1_700_000_000_000,
        notTodayDate: '2026-07-20',
        automaticInvitesDisabledAt: 1_700_000_000_001,
      }).success,
    ).toBe(true);
  });

  it('accepts each optional field independently', () => {
    expect(UserSiteTourStateSchema.safeParse({ completedVersion: 1 }).success).toBe(true);
    expect(UserSiteTourStateSchema.safeParse({ completedAt: 1 }).success).toBe(true);
    expect(UserSiteTourStateSchema.safeParse({ notTodayDate: '2026-01-01' }).success).toBe(true);
    expect(UserSiteTourStateSchema.safeParse({ automaticInvitesDisabledAt: 1 }).success).toBe(true);
  });

  it('rejects a malformed notTodayDate (strict YYYY-MM-DD)', () => {
    expect(UserSiteTourStateSchema.safeParse({ notTodayDate: '2026-7-20' }).success).toBe(false);
    expect(UserSiteTourStateSchema.safeParse({ notTodayDate: '07/20/2026' }).success).toBe(false);
    expect(UserSiteTourStateSchema.safeParse({ notTodayDate: '2026-07-20T00:00:00Z' }).success).toBe(false);
    expect(UserSiteTourStateSchema.safeParse({ notTodayDate: 20260720 }).success).toBe(false);
  });

  it('rejects a non-integer completedVersion', () => {
    expect(UserSiteTourStateSchema.safeParse({ completedVersion: 1.5 }).success).toBe(false);
  });

  it('strips unknown keys (non-strict, matching the privateData sub-object convention)', () => {
    const parsed = UserSiteTourStateSchema.parse({ completedVersion: 1, bogus: 'x' } as Record<string, unknown>);
    expect(parsed).toEqual({ completedVersion: 1 });
  });
});

describe('UserPrivateDataSchema — siteTour field', () => {
  it('accepts privateData with no siteTour field (never handled)', () => {
    expect(UserPrivateDataSchema.safeParse(basePrivateData).success).toBe(true);
  });

  it('accepts privateData with a valid siteTour', () => {
    expect(
      UserPrivateDataSchema.safeParse({
        ...basePrivateData,
        siteTour: { completedVersion: SITE_TOUR_CURRENT_VERSION, completedAt: 1_700_000_000_000 },
      }).success,
    ).toBe(true);
  });

  it('rejects privateData whose siteTour carries a malformed notTodayDate', () => {
    expect(
      UserPrivateDataSchema.safeParse({
        ...basePrivateData,
        siteTour: { notTodayDate: 'yesterday' },
      }).success,
    ).toBe(false);
  });
});

describe('SITE_TOUR_CURRENT_VERSION', () => {
  it('is the positive integer 1', () => {
    expect(SITE_TOUR_CURRENT_VERSION).toBe(1);
    expect(Number.isInteger(SITE_TOUR_CURRENT_VERSION)).toBe(true);
    expect(SITE_TOUR_CURRENT_VERSION).toBeGreaterThan(0);
  });
});
