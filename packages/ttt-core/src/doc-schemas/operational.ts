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

// reservedRealmNames/{workingTitleUppercase} — platform-wide Realm-name uniqueness claim, written
// in the createWorkRealm transaction (existence == name taken). Mirrors reservedDisplayNames; key is
// the UPPERCASE realm working title. (legal-convo [BUILD]: realm names unique platform-wide.)
export const ReservedRealmNameSchema = z.object({
  workRealmId: z.string(),
  workingTitle: z.string(),
});
export type ReservedRealmName = z.infer<typeof ReservedRealmNameSchema>;

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

// shortLinks/{shortId} — short link to an Audition / AuditionEntry, with a click counter.
// (functions/src/utility/createShortLink.ts)
export const ShortLinkSchema = z.object({
  shortId: z.string(),
  shortUrl: z.string(),
  destinationUrl: z.string(),
  type: z.enum(['audition', 'audition-entry']),
  metadata: z.object({
    auditionId: z.string(),
    auditionEntryId: z.string().nullable(),
  }),
  createdAt: z.number(),
  createdBy: z.string(),
  clicks: z.number(),
});
export type ShortLink = z.infer<typeof ShortLinkSchema>;

// statusReconcileQueue/{uid} — backend-only retry queue for post-commit auth-effect reconciliation.
// Written when an account-status change committed to Firestore but the follow-on Auth effect
// (custom-claim set / account disable) failed; a retry loop drives the account toward `targetStatus`
// and deletes the entry on success. Keyed by the affected uid (doc id == uid); Admin-SDK-only.
// Timestamps are epoch-millis numbers (this repo never uses Firestore Timestamps).
export const StatusReconcileQueueEntrySchema = z.object({
  uid: z.string(),
  enqueuedAt: z.number(),
  lastAttemptAt: z.number().optional(),
  attemptCount: z.number(),
  targetStatus: z.enum(['active', 'suspended', 'banned']),
  reason: z.literal('postCommitAuthEffectFailed'),
});
export type StatusReconcileQueueEntry = z.infer<typeof StatusReconcileQueueEntrySchema>;

// feedbackAliases/{aliasId} — Console-managed map collapsing a synonym suggestion onto a canonical
// one; read by submitFeedback, no callable writes it. (firestore.rules §3F / submitFeedback.ts)
export const FeedbackAliasSchema = z.object({
  canonicalId: z.string(),
  originalType: z.string(),
});
export type FeedbackAlias = z.infer<typeof FeedbackAliasSchema>;

// feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId} — an aggregated user
// suggestion with its deduped submitter list + count. The path nests the feedbackSubmissions +
// userSuggestions registry segments. (functions/src/utility/submitFeedback.ts)
export const UserSuggestionSchema = z.object({
  suggestionText: z.string(),
  count: z.number(),
  submittedBy: z.array(z.object({ userId: z.string() })),
  lastSubmitted: z.number(),
});
export type UserSuggestion = z.infer<typeof UserSuggestionSchema>;
