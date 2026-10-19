// `userProfiles/{userId}` — the account's profile, one per Firebase Auth uid. Ghosts have none.
// It is publicly readable (a profile page renders signed out), so it holds nothing personal:
// email and contact details live in its owner-only `privateData/{userId}` document (BACKEND-105).
// Plus its `historicalStats/{sportKey}` subcollection.

import { z } from 'zod';
import { THEME_NAMES } from '@ttt-productions/theme-core';
import { CONTACT_PHONE_INPUT_FORMAT } from '../input-formats/input-formats.js';
import { BasketballPlayerTotalsSchema, UserLifetimeStatsSchema } from './aggregate-stats.js';
import { epochMsSchema, textFieldSchema, userStatusSchema } from './atoms.js';
import { awardIdSchema } from './catalogs.js';

// A saved theme, typed by theme-core's theme set — the one declaration its provider renders from.
export const themeNameSchema = z.enum(THEME_NAMES);

// An award granted to this user. Name and imagery resolve from `awardDefinitions/{awardId}`.
export const GrantedAwardSchema = z.object({
  awardId: awardIdSchema,
  grantedAt: epochMsSchema,
});
export type GrantedAward = z.infer<typeof GrantedAwardSchema>;

export const UserProfileSchema = z.object({
  displayName: z.string(),
  displayName_lowercase: z.string(),
  // Written `active` at registration and by the profile copy; nothing else writes it.
  userStatus: userStatusSchema,
  // Per sport, the career line; career games played is the sum of their games played, derived at
  // read and never stored.
  lifetimeStats: UserLifetimeStatsSchema.optional(),
  grantedAwards: z.array(GrantedAwardSchema).optional(),
  // The awards the account shows beside its name, each one it holds.
  primaryAwardId: awardIdSchema.optional(),
  secondaryAwardId: awardIdSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// `userProfiles/{userId}/privateData/{userId}` — readable by its owner and by admins; written only
// by callables.
export const UserPrivateDataSchema = z.object({
  email: z.string(),
  // When this login's registration started (`createRegistrationStart`); `registerUser` refuses
  // without it. Absent on an account copied from V1, which registered before the step existed.
  registrationStartedAt: epochMsSchema.optional(),
  // When the orphan-registration cleanup decided to delete this uid's login. Written in the
  // cleanup's eligibility transaction BEFORE the Auth delete, and both registration steps answer
  // `registrationExpired` in their own transactions while it is present, so no registration
  // completes into a login that is about to be deleted. Backend-only.
  orphanDeletionClaimedAt: epochMsSchema.optional(),
  // Pre-fills the contact phone when this user creates a team.
  defaultContactPhone: textFieldSchema(CONTACT_PHONE_INPUT_FORMAT).optional(),
  // The account's copy of the viewer's settings, synced with the device's. Absent means the
  // account has saved nothing and the device's own choice stands.
  theme: themeNameSchema.optional(),
  reducedMotion: z.boolean().optional(),
  updatedAt: epochMsSchema,
});
export type UserPrivateData = z.infer<typeof UserPrivateDataSchema>;

// `userProfiles/{userId}/historicalStats/{sportKey}` — pre-Q-Sports career totals an admin enters,
// folded into lifetime and hall-of-fame recalculation. Absolute totals, not increments. Basketball is
// the sport with a baseline, so it is the basketball totals line without FP, which the rebuild
// derives when it folds the baseline in.
export const HistoricalStatsSchema = BasketballPlayerTotalsSchema.omit({ fantasyPoints: true });
export type HistoricalStats = z.infer<typeof HistoricalStatsSchema>;

// Every field of a baseline, keyed so the record cannot miss one or name one the schema lacks, in the
// order an admin enters them.
const HISTORICAL_STAT_ENTRY: Record<keyof HistoricalStats, true> = {
  gamesPlayed: true,
  points: true,
  rebounds: true,
  assists: true,
};

/** A baseline's totals, in the order an admin enters them. */
export const HISTORICAL_STAT_KEYS = Object.keys(
  HISTORICAL_STAT_ENTRY,
) as readonly (keyof HistoricalStats)[];
