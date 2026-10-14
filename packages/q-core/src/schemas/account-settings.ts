// Callable contract for the signed-in user's own settings on their owner-only
// `userProfiles/{userId}/privateData/{userId}` document: the account's copy of the viewer's theme
// and motion — the save theme-core's settings sync calls — and the account-only default contact
// phone. The caller is always the account being changed; no user id is ever sent.

import { z } from 'zod';
import { epochMsSchema } from '../doc-schemas/atoms.js';
import { themeNameSchema } from '../doc-schemas/user-profile.js';
import { contactPhoneSchema } from './atoms.js';

export const UpdateAccountSettingsInputSchema = z
  .object({
    theme: themeNameSchema.optional(),
    reducedMotion: z.boolean().optional(),
    // `null` removes the saved number.
    defaultContactPhone: contactPhoneSchema.nullable().optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Change at least one setting.',
  });
export type UpdateAccountSettingsInput = z.infer<typeof UpdateAccountSettingsInputSchema>;

// Every setting as committed, `null` where the account has nothing saved — the shape the settings
// sync reads the account's values in.
export const UpdateAccountSettingsResultSchema = z
  .object({
    theme: themeNameSchema.nullable(),
    reducedMotion: z.boolean().nullable(),
    defaultContactPhone: contactPhoneSchema.nullable(),
    updatedAt: epochMsSchema,
  })
  .strict();
export type UpdateAccountSettingsResult = z.infer<typeof UpdateAccountSettingsResultSchema>;
