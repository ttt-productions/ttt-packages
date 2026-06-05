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
