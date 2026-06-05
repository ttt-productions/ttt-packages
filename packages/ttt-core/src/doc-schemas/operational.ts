// Operational / utility Firestore document SCHEMAS — small backend-written docs that aren't
// part of a feature domain. Reverse-engineered from their backend write sites. Types via z.infer.

import { z } from 'zod';

// reservedDisplayNames/{displayNameUppercase} — uniqueness claim written in the registerUser
// transaction; existence == name taken. (functions/src/users/registerUser.ts)
export const ReservedDisplayNameSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
});
export type ReservedDisplayName = z.infer<typeof ReservedDisplayNameSchema>;

// stakeShareAuditEvents/{eventId} — Firestore-trigger audit of guildmate stake-share changes.
// (functions/src/audit/runWorkProjectGuildmateUserStakeShareAudit.ts)
export const StakeShareAuditEventSchema = z.object({
  eventId: z.string(),
  subtype: z.string(),
  reason: z.string(),
  workProjectId: z.string(),
  guildmateUserUid: z.string(),
  guildmateUserPath: z.string(),
  beforeStakeShares: z.number().nullable(),
  afterStakeShares: z.number().nullable(),
  createdAt: z.number(),
  source: z.string(),
});
export type StakeShareAuditEvent = z.infer<typeof StakeShareAuditEventSchema>;
