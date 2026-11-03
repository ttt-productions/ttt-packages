import { z } from 'zod';
import { epochMsSchema } from '../doc-schemas/atoms.js';
import { textFieldSchema } from './text-field.js';
import {
  ANNOUNCEMENT_MESSAGE_INPUT,
  APP_VERSION_INPUT,
  LANDING_ABOUT_TEXT_INPUT,
  LANDING_HERO_TITLE_INPUT,
  MAINTENANCE_MESSAGE_INPUT,
} from '../constants/text-fields.js';
import { AppConfigSchema } from '../doc-schemas/system.js';

export const AdminUpdateAppConfigInputSchema = z
  .object({
    appVersion: textFieldSchema(APP_VERSION_INPUT).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: textFieldSchema(MAINTENANCE_MESSAGE_INPUT).optional(),
    registrationEnabled: z.boolean().optional(),
    announcementMessage: textFieldSchema(ANNOUNCEMENT_MESSAGE_INPUT).optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Change at least one setting.',
  });
export type AdminUpdateAppConfigInput = z.infer<typeof AdminUpdateAppConfigInputSchema>;

export const AdminUpdateAppConfigResultSchema = z
  .object({ updatedFields: z.array(AppConfigSchema.keyof()) })
  .strict();
export type AdminUpdateAppConfigResult = z.infer<typeof AdminUpdateAppConfigResultSchema>;

export const AdminUpdateLandingPageInputSchema = z
  .object({
    heroTitle: textFieldSchema(LANDING_HERO_TITLE_INPUT).optional(),
    aboutCompany: textFieldSchema(LANDING_ABOUT_TEXT_INPUT).optional(),
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
