import { describe, it, expect } from 'vitest';
import {
  BecomeArtisanCreatorInputSchema,
  MarkNonUsArtisanInterestInputSchema,
  LookupUserByEmailOrUidInputSchema,
  UpdateSiteTourPreferenceInputSchema,
} from '../src/schemas/users.js';
import { MAX_USER_SEARCH_QUERY_LENGTH } from '../src/constants/business-admin.js';
import {
  ARTISAN_CREATOR_AGREEMENT_IDS,
  ARTISAN_CREATOR_AGREEMENTS_VERSION,
} from '../src/constants/member-agreements.js';

describe('BecomeArtisanCreatorInputSchema (a U.S. Yes, a DOB, and every box under the shown wording)', () => {
  const dob = { year: 1990, month: 5, day: 17 };
  const agreements = {
    realDateOfBirth: true,
    humanMadeOnly: true,
    uploadRights: true,
    rulesAndAgreements: true,
    collaborateOnline: true,
  } as const;
  const valid = {
    livesInUnitedStates: true,
    dob,
    agreements,
    agreementsVersion: ARTISAN_CREATOR_AGREEMENTS_VERSION,
  };

  it('accepts a Yes, a valid dob, every box ticked, and the current wording version', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse(valid).success).toBe(true);
  });

  it('names exactly the boxes the dialog shows', () => {
    expect(Object.keys(agreements)).toEqual([...ARTISAN_CREATOR_AGREEMENT_IDS]);
  });

  it('rejects a No (or a missing answer) — only U.S. persons may become Artisans', () => {
    const { livesInUnitedStates: _omitted, ...withoutAnswer } = valid;
    expect(BecomeArtisanCreatorInputSchema.safeParse(withoutAnswer).success).toBe(false);
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({ ...valid, livesInUnitedStates: false }).success,
    ).toBe(false);
  });

  it.each(ARTISAN_CREATOR_AGREEMENT_IDS)('rejects when %s is not ticked', (id) => {
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({
        ...valid,
        agreements: { ...agreements, [id]: false },
      }).success,
    ).toBe(false);
    const { [id]: _omitted, ...withoutBox } = agreements;
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({ ...valid, agreements: withoutBox }).success,
    ).toBe(false);
  });

  it('rejects any wording version but the current one', () => {
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({
        ...valid,
        agreementsVersion: ARTISAN_CREATOR_AGREEMENTS_VERSION + 1,
      }).success,
    ).toBe(false);
  });

  it('rejects when dob is missing (the artisan DOB is the only persisted DOB in the system)', () => {
    const { dob: _omitted, ...withoutDob } = valid;
    expect(BecomeArtisanCreatorInputSchema.safeParse(withoutDob).success).toBe(false);
  });

  it('rejects an out-of-range dob month/day and a non-integer year', () => {
    for (const bad of [
      { year: 1990, month: 13, day: 1 },
      { year: 1990, month: 1, day: 32 },
      { year: 1990.5, month: 1, day: 1 },
    ]) {
      expect(BecomeArtisanCreatorInputSchema.safeParse({ ...valid, dob: bad }).success).toBe(false);
    }
  });

  it('rejects extra fields inside dob (dob is .strict())', () => {
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({ ...valid, dob: { ...dob, extra: 1 } }).success,
    ).toBe(false);
  });

  it('rejects a truthy non-boolean box', () => {
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({
        ...valid,
        agreements: { ...agreements, humanMadeOnly: 'true' },
      }).success,
    ).toBe(false);
  });

  it('rejects an empty input, an unknown box, and unknown extra fields', () => {
    expect(BecomeArtisanCreatorInputSchema.safeParse({}).success).toBe(false);
    expect(
      BecomeArtisanCreatorInputSchema.safeParse({
        ...valid,
        agreements: { ...agreements, extra: true },
      }).success,
    ).toBe(false);
    expect(BecomeArtisanCreatorInputSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe('MarkNonUsArtisanInterestInputSchema (non-U.S. artisan waitlist signup)', () => {
  it('accepts a country (+ optional region)', () => {
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({ country: 'Canada' }).success).toBe(true);
    expect(
      MarkNonUsArtisanInterestInputSchema.safeParse({ country: 'Canada', region: 'Ontario' })
        .success,
    ).toBe(true);
  });

  it('rejects a missing/empty country', () => {
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({}).success).toBe(false);
    expect(MarkNonUsArtisanInterestInputSchema.safeParse({ country: '' }).success).toBe(false);
  });

  it('rejects unknown extra fields (schema is .strict())', () => {
    expect(
      MarkNonUsArtisanInterestInputSchema.safeParse({ country: 'Canada', extra: 1 }).success,
    ).toBe(false);
  });
});

describe('UpdateSiteTourPreferenceInputSchema (first-visit tour preference writer)', () => {
  it('accepts deferToday with a valid YYYY-MM-DD local date', () => {
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'deferToday', date: '2026-07-20' })
        .success,
    ).toBe(true);
  });

  it('rejects deferToday with a malformed / non-YYYY-MM-DD date', () => {
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'deferToday', date: '2026-7-20' })
        .success,
    ).toBe(false);
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'deferToday', date: '07/20/2026' })
        .success,
    ).toBe(false);
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'deferToday', date: 'not-a-date' })
        .success,
    ).toBe(false);
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({
        action: 'deferToday',
        date: '2026-07-20T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('rejects deferToday without a date (the payload is required for this branch)', () => {
    expect(UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'deferToday' }).success).toBe(
      false,
    );
  });

  it('accepts dismissAutomaticInvites and completeTour with no payload', () => {
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'dismissAutomaticInvites' }).success,
    ).toBe(true);
    expect(UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'completeTour' }).success).toBe(
      true,
    );
  });

  it('rejects a client-supplied version on completeTour (the version is server-owned, .strict())', () => {
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'completeTour', version: 1 }).success,
    ).toBe(false);
  });

  it('rejects an unknown action and a missing action', () => {
    expect(UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'replayTour' }).success).toBe(
      false,
    );
    expect(UpdateSiteTourPreferenceInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a date payload on the payload-free branches (each branch is .strict())', () => {
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({
        action: 'dismissAutomaticInvites',
        date: '2026-07-20',
      }).success,
    ).toBe(false);
    expect(
      UpdateSiteTourPreferenceInputSchema.safeParse({ action: 'completeTour', extra: 1 }).success,
    ).toBe(false);
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
      LookupUserByEmailOrUidInputSchema.safeParse({
        query: 'a'.repeat(MAX_USER_SEARCH_QUERY_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      LookupUserByEmailOrUidInputSchema.safeParse({
        query: 'a'.repeat(MAX_USER_SEARCH_QUERY_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('rejects unknown extra fields (schema is .strict())', () => {
    expect(LookupUserByEmailOrUidInputSchema.safeParse({ query: 'x', extra: 1 }).success).toBe(
      false,
    );
  });
});
