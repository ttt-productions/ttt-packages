// System Firestore document SCHEMAS — the `_config/app` runtime-config singleton.
// Type inferred via z.infer. (Field docs live in ../types/system.ts.)

import { z } from 'zod';

export const AppConfigSchema = z.object({
  appVersion: z.string(),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().optional(),
  registrationEnabled: z.boolean(),
  // Runtime abuse throttle (incident lever — NOT the charter/full mode, which is
  // a ttt-core code constant). Scales every rate limiter's maxRequests DOWN:
  // 0 < m <= 1, tighten-only. Absent = 1 (no throttle). Set via updateAppConfig
  // (audited); read by the backend limiter wrapper with a short in-memory cache.
  rateLimitMultiplier: z.number().gt(0).max(1).optional(),
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
// (functions/src/utility/seedProfanityList.ts / curateProfanityList.ts)
export const ProfanityListSchema = z.object({
  words: z.array(z.string()),
  updatedAt: z.number(),
  wordCount: z.number(),
  // Monotonic version for the chat-realtime word-list sync (Contract B). Bumped by each
  // curation; the chat Worker KV snapshot + the channel-DO lazy version check key on it.
  // Absent ⇒ 0.
  wordListVersion: z.number().optional(),
});
export type ProfanityList = z.infer<typeof ProfanityListSchema>;

// _systemData/reservedUsernames — curated brand/impersonation terms blocked at registration
// by exact normalized (UPPERCASE) match. Distinct from the per-user `reservedDisplayNames`
// uniqueness collection. Seeded by functions/src/utility/seedReservedUsernames.ts; consulted by
// registerUser + checkDisplayNameAvailable. Names are stored UPPERCASE to match the
// reservedDisplayName case-folding convention.
export const ReservedUsernamesSchema = z.object({
  names: z.array(z.string()),
  updatedAt: z.number(),
});
export type ReservedUsernames = z.infer<typeof ReservedUsernamesSchema>;
