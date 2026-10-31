import { z } from 'zod';
import { THEME_NAMES } from '@ttt-productions/theme-core';
import { EMAIL_MAX_LENGTH } from '../constants/business.js';
import { CONTACT_PHONE_INPUT_FORMAT } from '../input-formats/input-formats.js';
import { BasketballPlayerTotalsSchema, UserLifetimeStatsSchema } from './aggregate-stats.js';
import { epochMsSchema, textFieldSchema, userStatusSchema } from './atoms.js';
import { awardIdSchema } from './catalogs.js';

export const themeNameSchema = z.enum(THEME_NAMES);

export const GrantedAwardSchema = z.object({
  awardId: awardIdSchema,
  grantedAt: epochMsSchema,
});
export type GrantedAward = z.infer<typeof GrantedAwardSchema>;

export const UserProfileSchema = z.object({
  displayName: z.string(),
  displayName_lowercase: z.string(),
  userStatus: userStatusSchema,
  lifetimeStats: UserLifetimeStatsSchema.optional(),
  grantedAwards: z.array(GrantedAwardSchema).optional(),
  primaryAwardId: awardIdSchema.optional(),
  secondaryAwardId: awardIdSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserPrivateDataSchema = z.object({
  email: z.string().max(EMAIL_MAX_LENGTH),
  registrationStartedAt: epochMsSchema.optional(),
  orphanDeletionClaimedAt: epochMsSchema.optional(),
  defaultContactPhone: textFieldSchema(CONTACT_PHONE_INPUT_FORMAT).optional(),
  theme: themeNameSchema.optional(),
  reducedMotion: z.boolean().optional(),
  updatedAt: epochMsSchema,
});
export type UserPrivateData = z.infer<typeof UserPrivateDataSchema>;

export const HistoricalStatsSchema = BasketballPlayerTotalsSchema.omit({ fantasyPoints: true });
export type HistoricalStats = z.infer<typeof HistoricalStatsSchema>;

const HISTORICAL_STAT_ENTRY: Record<keyof HistoricalStats, true> = {
  gamesPlayed: true,
  points: true,
  rebounds: true,
  assists: true,
};

export const HISTORICAL_STAT_KEYS = Object.keys(
  HISTORICAL_STAT_ENTRY,
) as readonly (keyof HistoricalStats)[];
