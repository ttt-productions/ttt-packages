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
