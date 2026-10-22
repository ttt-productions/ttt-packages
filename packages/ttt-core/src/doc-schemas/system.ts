import { z } from 'zod';
import {
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  MAX_APP_VERSION_LENGTH,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
} from '../constants/business-admin.js';
import { APP_MODES } from '../constants/app-mode.js';
import { PublicDocumentVersionBlockSchema } from './public-documents.js';

export const AppConfigSchema = z.object({
  // '' (DEFAULT_APP_CONFIG) is valid here; only the update input requires a value.
  appVersion: z.string().max(MAX_APP_VERSION_LENGTH),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().max(MAX_MAINTENANCE_MESSAGE_LENGTH).optional(),
  registrationEnabled: z.boolean(),
  announcementMessage: z.string().max(MAX_ANNOUNCEMENT_MESSAGE_LENGTH).optional(),
  rateLimitMultiplier: z.number().gt(0).max(1).optional(),
  publicDocumentVersions: PublicDocumentVersionBlockSchema.optional(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const AdminListSchema = z.object({
  admins: z.array(z.string()),
  jrAdmins: z.array(z.string()),
});
export type AdminList = z.infer<typeof AdminListSchema>;

export const ProfanityListSchema = z.object({
  words: z.array(z.string()),
  updatedAt: z.number(),
  wordCount: z.number(),
  wordListVersion: z.number().optional(),
});
export type ProfanityList = z.infer<typeof ProfanityListSchema>;

export const ReservedUsernamesSchema = z.object({
  names: z.array(z.string()),
  updatedAt: z.number(),
});
export type ReservedUsernames = z.infer<typeof ReservedUsernamesSchema>;

export const BlockedFranchiseNamesSchema = z.object({
  names: z.array(z.string()),
  updatedAt: z.number(),
});
export type BlockedFranchiseNames = z.infer<typeof BlockedFranchiseNamesSchema>;

export const AppModeSchema = z.enum(APP_MODES);

export const AppModeMarkerSchema = z.object({
  current: AppModeSchema,
  updatedAt: z.number(),
});
export type AppModeMarker = z.infer<typeof AppModeMarkerSchema>;
