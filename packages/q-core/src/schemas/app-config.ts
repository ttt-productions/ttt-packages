import { z } from 'zod';
import { epochMsSchema, textFieldSchema } from '../doc-schemas/atoms.js';
import {
  ANNOUNCEMENT_MESSAGE_INPUT_FORMAT,
  APP_VERSION_INPUT_FORMAT,
  LANDING_ABOUT_TEXT_INPUT_FORMAT,
  LANDING_HERO_TITLE_INPUT_FORMAT,
  MAINTENANCE_MESSAGE_INPUT_FORMAT,
} from '../input-formats/input-formats.js';
import { AppConfigSchema } from '../doc-schemas/system.js';

export const UpdateAppConfigInputSchema = z
  .object({
    appVersion: textFieldSchema(APP_VERSION_INPUT_FORMAT).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: textFieldSchema(MAINTENANCE_MESSAGE_INPUT_FORMAT).optional(),
    registrationEnabled: z.boolean().optional(),
    announcementMessage: textFieldSchema(ANNOUNCEMENT_MESSAGE_INPUT_FORMAT).optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Change at least one setting.',
  });
export type UpdateAppConfigInput = z.infer<typeof UpdateAppConfigInputSchema>;

export const UpdateAppConfigResultSchema = z
  .object({ updatedFields: z.array(AppConfigSchema.keyof()) })
  .strict();
export type UpdateAppConfigResult = z.infer<typeof UpdateAppConfigResultSchema>;

export const AdminUpdateLandingPageInputSchema = z
  .object({
    heroTitle: textFieldSchema(LANDING_HERO_TITLE_INPUT_FORMAT).optional(),
    aboutCompany: textFieldSchema(LANDING_ABOUT_TEXT_INPUT_FORMAT).optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  });
export type AdminUpdateLandingPageInput = z.infer<typeof AdminUpdateLandingPageInputSchema>;

export const AdminUpdateLandingPageResultSchema = z
  .object({
    heroTitle: z.string(),
    aboutCompany: z.string(),
    updatedAt: epochMsSchema,
  })
  .strict();
export type AdminUpdateLandingPageResult = z.infer<typeof AdminUpdateLandingPageResultSchema>;
