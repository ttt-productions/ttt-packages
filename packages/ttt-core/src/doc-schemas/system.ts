// System Firestore document SCHEMAS — the `_config/app` runtime-config singleton.
// Type inferred via z.infer. (Field docs live in ../types/system.ts.)

import { z } from 'zod';

export const AppConfigSchema = z.object({
  appVersion: z.string(),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().optional(),
  registrationEnabled: z.boolean(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

// _systemData/adminList — the admin / jrAdmin uid lists; source of truth synced to custom claims
// by setAdminStatusClaim. (functions/src/auth/runUpdateAdminList.ts)
export const AdminListSchema = z.object({
  admins: z.array(z.string()),
  jrAdmins: z.array(z.string()),
});
export type AdminList = z.infer<typeof AdminListSchema>;

// _systemData/profanityList — the moderation word list read by the runtime text filter.
// (functions/src/utility/initProfanityList.ts / curateProfanityList.ts)
export const ProfanityListSchema = z.object({
  words: z.array(z.string()),
  updatedAt: z.number(),
  wordCount: z.number(),
});
export type ProfanityList = z.infer<typeof ProfanityListSchema>;
