// Operational / utility Firestore document SCHEMAS — small backend-written docs that aren't
// part of a feature domain. Reverse-engineered from their backend write sites. Types via z.infer.

import { z } from 'zod';
import { UserAccountStatusSchema } from './user.js';

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
  // RETIRED name (DJ ruling 2026-07-12, option B): set true when a moderation
  // force-retitle removes this name — the name is dead platform-wide FOREVER; no
  // realm (including the original owner) can ever claim it again, and no rename
  // path releases the reservation. Ordinary renames release un-retired
  // reservations normally. Backend-only-writable.
  retired: z.boolean().optional(),
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

// shortLinks/{shortId} — short link to a share target (Audition / AuditionEntry /
// Commission), with a click counter. (functions/src/utility/createShortLink.ts)
// `type` mirrors the CreateShortLinkInput target type; `metadata` carries the target
// id(s) the destination URL was built from. Fields are per-target-optional so a new
// target type slots in without reworking the map. Add a `type` value when adding a target.
export const ShortLinkSchema = z.object({
  shortId: z.string(),
  shortUrl: z.string(),
  destinationUrl: z.string(),
  type: z.enum(['audition', 'audition-entry', 'commission']),
  metadata: z.object({
    auditionId: z.string().nullable(),
    auditionEntryId: z.string().nullable(),
    commissionListingId: z.string().nullable(),
  }),
  createdAt: z.number(),
  createdBy: z.string(),
  clicks: z.number(),
});
export type ShortLink = z.infer<typeof ShortLinkSchema>;

// statusReconcileQueue/{uid} — backend-only retry queue for post-commit Auth-effect reconciliation.
// Written when a change committed to Firestore but its follow-on Auth effect failed; the drain
// re-converges every Auth-side mirror of the uid from its canonical docs and deletes the entry on
// success. Keyed by the affected uid (doc id == uid; one entry per uid, whichever effect queued
// it); Admin-SDK-only. Timestamps are epoch-millis numbers (this repo never uses Firestore
// Timestamps).

/**
 * Which post-commit Auth effect failed and queued the uid:
 * - `accountStatus` — the status claim / `disabled` flag / token revocation after a status change;
 * - `publicDocumentsAcceptedClaim` — the `docsAccepted` claim after a public-document acceptance.
 * An entry without `authEffect` predates the field and is an `accountStatus` entry.
 */
export const STATUS_RECONCILE_QUEUE_AUTH_EFFECTS = ['accountStatus', 'publicDocumentsAcceptedClaim'] as const;
export const StatusReconcileQueueAuthEffectSchema = z.enum(STATUS_RECONCILE_QUEUE_AUTH_EFFECTS);
export type StatusReconcileQueueAuthEffect = z.infer<typeof StatusReconcileQueueAuthEffectSchema>;

const statusReconcileQueueEntryBase = {
  uid: z.string(),
  enqueuedAt: z.number(),
  lastAttemptAt: z.number().optional(),
  attemptCount: z.number(),
  reason: z.literal('postCommitAuthEffectFailed'),
};

/** A failed status effect: the drain drives the account toward `targetStatus`. */
export const StatusReconcileQueueAccountStatusEntrySchema = z.object({
  ...statusReconcileQueueEntryBase,
  authEffect: z.literal('accountStatus' satisfies StatusReconcileQueueAuthEffect).optional(),
  targetStatus: UserAccountStatusSchema,
});
export type StatusReconcileQueueAccountStatusEntry = z.infer<typeof StatusReconcileQueueAccountStatusEntrySchema>;

/** A failed `docsAccepted` claim write. Strict: it carries no status, so no `targetStatus`. */
export const StatusReconcileQueuePublicDocumentsAcceptedClaimEntrySchema = z
  .object({
    ...statusReconcileQueueEntryBase,
    authEffect: z.literal('publicDocumentsAcceptedClaim' satisfies StatusReconcileQueueAuthEffect),
  })
  .strict();
export type StatusReconcileQueuePublicDocumentsAcceptedClaimEntry = z.infer<
  typeof StatusReconcileQueuePublicDocumentsAcceptedClaimEntrySchema
>;

export const StatusReconcileQueueEntrySchema = z.discriminatedUnion('authEffect', [
  StatusReconcileQueueAccountStatusEntrySchema,
  StatusReconcileQueuePublicDocumentsAcceptedClaimEntrySchema,
]);
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
