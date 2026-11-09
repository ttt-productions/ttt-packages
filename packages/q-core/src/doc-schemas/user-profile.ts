import { z } from 'zod';
import { THEME_NAMES } from '@ttt-productions/theme-core';
import { ACCOUNT_EMAIL_MAX_LENGTH } from '@ttt-productions/auth-core';
import { DISPLAY_NAME_INPUT } from '../constants/text-fields.js';
import { CONTACT_PHONE_INPUT } from '../constants/phone-fields.js';
import { BasketballPlayerTotalsSchema, UserLifetimeStatsSchema } from './aggregate-stats.js';
import { epochMsSchema, userStatusSchema } from './atoms.js';
import { textFieldSchema } from '../schemas/text-field.js';
import { storedPhoneFieldSchema } from '../schemas/phone-field.js';
import { awardIdSchema } from './catalogs.js';

export const themeNameSchema = z.enum(THEME_NAMES);

export const GrantedAwardSchema = z.object({
  awardId: awardIdSchema,
  grantedAt: epochMsSchema,
});
export type GrantedAward = z.infer<typeof GrantedAwardSchema>;

export const UserProfileSchema = z.object({
  displayName: textFieldSchema(DISPLAY_NAME_INPUT),
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
  email: z.string().max(ACCOUNT_EMAIL_MAX_LENGTH),
  defaultContactPhone: storedPhoneFieldSchema(CONTACT_PHONE_INPUT).optional(),
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
