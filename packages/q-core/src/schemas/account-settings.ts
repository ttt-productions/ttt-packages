import { z } from 'zod';
import { epochMsSchema } from '../doc-schemas/atoms.js';
import { themeNameSchema } from '../doc-schemas/user-profile.js';
import { CONTACT_PHONE_INPUT } from '../constants/phone-fields.js';
import { contactPhoneSchema } from './atoms.js';
import { storedPhoneFieldSchema } from './phone-field.js';

export const UpdateUserProfileSettingsInputSchema = z
  .object({
    theme: themeNameSchema.optional(),
    reducedMotion: z.boolean().optional(),
    defaultContactPhone: contactPhoneSchema.nullable().optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Change at least one setting.',
  });
export type UpdateUserProfileSettingsInput = z.infer<typeof UpdateUserProfileSettingsInputSchema>;

export const UpdateUserProfileSettingsResultSchema = z
  .object({
    theme: themeNameSchema.nullable(),
    reducedMotion: z.boolean().nullable(),
    defaultContactPhone: storedPhoneFieldSchema(CONTACT_PHONE_INPUT).nullable(),
    updatedAt: epochMsSchema,
  })
  .strict();
export type UpdateUserProfileSettingsResult = z.infer<typeof UpdateUserProfileSettingsResultSchema>;
