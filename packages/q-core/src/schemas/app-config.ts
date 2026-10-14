// Callable contracts for the `_appConfig` documents an admin edits: the app-wide operational levers
// and the landing page copy. Each input is a named field set (BACKEND-209) — never a document id
// and a `data` blob.

import { z } from 'zod';
import { epochMsSchema, textFieldSchema } from '../doc-schemas/atoms.js';
import {
  ANNOUNCEMENT_MESSAGE_INPUT_FORMAT,
  APP_VERSION_INPUT_FORMAT,
  LANDING_ABOUT_TEXT_INPUT_FORMAT,
  LANDING_HERO_TITLE_INPUT_FORMAT,
  MAINTENANCE_MESSAGE_INPUT_FORMAT,
} from '../input-formats/index.js';
import { AppConfigSchema } from '../doc-schemas/system.js';

// An admin changes one or more levers on `_appConfig/app`. A lever left out keeps its value.
export const UpdateAppConfigInputSchema = z
  .object({
    // A published version is never blank: `''` is only the dormant default of a fresh environment.
    appVersion: textFieldSchema(APP_VERSION_INPUT_FORMAT).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: textFieldSchema(MAINTENANCE_MESSAGE_INPUT_FORMAT).optional(),
    registrationEnabled: z.boolean().optional(),
    // `''` clears the banner.
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

// An admin edits the landing page copy on `_appConfig/landingPage`. Both fields are sent together,
// as the editor saves them. The landing gallery is not part of this: only the picture core writes it.
export const AdminUpdateLandingPageInputSchema = z
  .object({
    heroTitle: textFieldSchema(LANDING_HERO_TITLE_INPUT_FORMAT),
    aboutCompany: textFieldSchema(LANDING_ABOUT_TEXT_INPUT_FORMAT),
  })
  .strict();
export type AdminUpdateLandingPageInput = z.infer<typeof AdminUpdateLandingPageInputSchema>;

// The copy as committed, so the caller can apply it to its cached landing document.
export const AdminUpdateLandingPageResultSchema = z
  .object({
    heroTitle: z.string(),
    aboutCompany: z.string(),
    updatedAt: epochMsSchema,
  })
  .strict();
export type AdminUpdateLandingPageResult = z.infer<typeof AdminUpdateLandingPageResultSchema>;
