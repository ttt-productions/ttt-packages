import { z } from 'zod';
import { epochMsSchema } from '../doc-schemas/atoms.js';
import { themeNameSchema } from '../doc-schemas/user-profile.js';
import { contactPhoneSchema } from './atoms.js';

export const UpdateAccountSettingsInputSchema = z
  .object({
    theme: themeNameSchema.optional(),
    reducedMotion: z.boolean().optional(),
    defaultContactPhone: contactPhoneSchema.nullable().optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Change at least one setting.',
  });
export type UpdateAccountSettingsInput = z.infer<typeof UpdateAccountSettingsInputSchema>;

export const UpdateAccountSettingsResultSchema = z
  .object({
    theme: themeNameSchema.nullable(),
    reducedMotion: z.boolean().nullable(),
    defaultContactPhone: contactPhoneSchema.nullable(),
    updatedAt: epochMsSchema,
  })
  .strict();
export type UpdateAccountSettingsResult = z.infer<typeof UpdateAccountSettingsResultSchema>;
