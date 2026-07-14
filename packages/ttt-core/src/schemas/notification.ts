// TTT notification contracts.
//
// `@ttt-productions/notification-core` is generic — at its package boundary a
// notification's `metadata` is `Record<string, unknown>`. All TTT notification
// policy lives here: the canonical type catalog (category / delivery / default
// channels), the per-type typed `metadata` discriminated union, the broadcast
// audience selector, and the callable input schemas. `runSendNotification`
// (ttt-prod) validates `metadata` against the per-type schema before any write.
//
// The two notification audit-event payload shapes live here too (the
// `AuditEventType` union members `notification.broadcastSent` /
// `notification.adminArchived` are added in ../types/audit.ts; their actor is
// always an admin mode — `adminReview` / `adminOverride`).

import { z } from 'zod';
import {
  userIdSchema,
  workProjectIdSchema,
  guildInviteIdSchema,
  adminDispatchIdSchema,
  hallItemIdSchema,
  thresholdItemIdSchema,
  changeRequestIdSchema,
  workProjectTypeSchema,
  notificationFanoutJobIdSchema,
  titleSchema,
  reportGroupIdSchema,
} from './atoms.js';
import {
  MAX_THRESHOLD_REVIEW_NOTES_LENGTH,
  MAX_HALL_CHANGE_REQUEST_REASON_LENGTH,
  MAX_NOTIFICATION_MESSAGE_LENGTH,
  MAX_BROADCAST_EXPLICIT_UIDS,
} from '../constants/business.js';
import { HallSubItemTypeSchema } from '../doc-schemas/content.js';
import { ReportableItemTypeSchema } from '../doc-schemas/safety/foundation.js';

// String shape atoms specific to notifications.
const notificationMessageSchema = z.string().min(1).max(MAX_NOTIFICATION_MESSAGE_LENGTH);
// The canonical reportable-item enum — never an open string (Rule 36).
const reportedItemTypeSchema = ReportableItemTypeSchema;
const reportedItemIdSchema = z.string().min(1).max(128);
const reportIdSchema = z.string().min(1);
const appealIdSchema = z.string().min(1);
const workRealmIdSchema = z.string().min(1);

// ============================================================================
// TYPE + CHANNEL CATALOG
// ============================================================================

export const NOTIFICATION_TYPE_VALUES = [
  'content_report',
  'guild_invite',
  'admin_dispatch_reply',
  'threshold_library_submission',
  // Author feedback for a Threshold Library review decision (only needs_revision is
  // delivered today — an approval reaches the author via the publish member fanout).
  'threshold_library_reviewed',
  // Proposer feedback for a PUBLISHED change-request decision (approve/deny).
  'hall_content_change_request_resolved',
  'admin_announcement',
  'followed_content_published',
  // chat-edge-rebuild P7 — the two new fanout triggers (NOTIFICATIONS_REDESIGN "Triggers").
  // `member_content_published`: the Hall-publish MEMBER job ("your work was published!") — same
  //   `thresholdItemId` eventId as the follower job, different type so `deliveryId` stays distinct.
  // `followed_craft_skill_published`: craft-skill publish → the artisan's followers
  //   (`staticRelight` strategy — count 1 forever, static copy, no count shown).
  'member_content_published',
  'followed_craft_skill_published',
  // Reporter feedback (DJ ruling 2026-07-06): when a report a user submitted is
  // closed as a REAL case WITH action (ordinary report root flips to `actioned`),
  // the reporter gets one light informational card. Never sent on dismissals.
  // Generic copy only — the card must not reveal the reported user, reason, or
  // remedy (a bad-faith reporter must not be able to probe moderation outcomes).
  'report_action_taken',
  // Appellant feedback for a content-appeal decision (DJ ruling 2026-07-10 —
  // gap found by the hosted E2E build: reviewContentAppeal decided appeals with
  // NO channel reporting the outcome to the appellant). Fired on BOTH approve
  // and deny. It is the appellant's OWN appeal, so unlike report_action_taken
  // there is no privacy ceiling: the card states the outcome plainly and
  // targets My Uploads, where the resulting upload state lives.
  'content_appeal_reviewed',
] as const;

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPE_VALUES);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

/** Delivery channels. Only `inApp` is implemented at launch; `email`/`push`
 * are future channel handlers dispatched from the `runSendNotification`
 * chokepoint. */
export const NOTIFICATION_CHANNEL_VALUES = ['inApp', 'email', 'push'] as const;
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNEL_VALUES);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export type NotificationCategory = 'user' | 'admin';
export const NotificationCategorySchema = z.enum(['user', 'admin']);

export interface NotificationTypeCatalogEntry {
  /** Which active collection / audience this type writes to. */
  category: NotificationCategory;
  /** `realtime` writes straight to active; `queued` goes through the batch processor. */
  delivery: 'realtime' | 'queued';
  /** Default channel list applied when a send omits `channels`. All `['inApp']` at launch. */
  defaultChannels: NotificationChannel[];
}

/**
 * The canonical TTT notification type catalog. `runSendNotification` resolves a
 * type's category/delivery here and carries `defaultChannels` through when a
 * send omits `channels`.
 */
export const NOTIFICATION_TYPE_CATALOG: Record<NotificationType, NotificationTypeCatalogEntry> = {
  content_report: { category: 'admin', delivery: 'realtime', defaultChannels: ['inApp'] },
  guild_invite: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  admin_dispatch_reply: { category: 'user', delivery: 'realtime', defaultChannels: ['inApp'] },
  threshold_library_submission: { category: 'admin', delivery: 'queued', defaultChannels: ['inApp'] },
  threshold_library_reviewed: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  hall_content_change_request_resolved: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  admin_announcement: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  followed_content_published: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  member_content_published: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  followed_craft_skill_published: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  report_action_taken: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  content_appeal_reviewed: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
};

// ============================================================================
// PER-TYPE METADATA (discriminated union, keyed by `type`)
// ============================================================================

/**
 * Typed `metadata` payload for each notification type. The generic package
 * boundary takes `Record<string, unknown>`; the app validates against this
 * before sending so each type's payload is checked like every other callable
 * schema.
 */
export const NotificationMetadataByTypeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('content_report'),
    reportGroupId: reportGroupIdSchema,
    reportedItemType: reportedItemTypeSchema,
    reportedItemId: reportedItemIdSchema,
  }).strict(),
  z.object({
    type: z.literal('guild_invite'),
    workProjectId: workProjectIdSchema,
    guildInviteId: guildInviteIdSchema,
    workTitle: titleSchema,
  }).strict(),
  z.object({
    type: z.literal('admin_dispatch_reply'),
    adminDispatchId: adminDispatchIdSchema,
    // Party-generic dispatch: present on workProject-party threads so the card routes
    // to the Work's correspondence surface. Absent on user-party threads (legacy shape).
    partyKind: z.enum(['user', 'workProject']).optional(),
    workProjectId: workProjectIdSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('threshold_library_submission'),
    thresholdItemId: thresholdItemIdSchema,
    hallItemId: hallItemIdSchema,
    workProjectId: workProjectIdSchema,
  }).strict(),
  // Author feedback for a review decision. Mirrors what runReviewThresholdItem
  // (ttt-prod) sends: only `needs_revision` is delivered today; `adminNotes` is
  // the reviewer's note, sent as null when the reviewer left none.
  z.object({
    type: z.literal('threshold_library_reviewed'),
    thresholdItemId: thresholdItemIdSchema,
    hallItemId: hallItemIdSchema,
    workProjectId: workProjectIdSchema,
    workProjectType: workProjectTypeSchema,
    itemId: z.string().min(1),
    decision: z.literal('needs_revision'),
    adminNotes: z.string().max(MAX_THRESHOLD_REVIEW_NOTES_LENGTH).nullable(),
  }).strict(),
  // Proposer feedback for a published change-request decision. Mirrors what
  // runReviewHallContentChangeRequest (ttt-prod) sends: `resolutionReason` is
  // required on a deny, optional on an approve — null when absent. The realm
  // grain (R1) sends `workRealmId` with `hallItemId` null; hall grains the
  // reverse.
  z.object({
    type: z.literal('hall_content_change_request_resolved'),
    changeRequestId: changeRequestIdSchema,
    hallItemId: hallItemIdSchema.nullable(),
    workRealmId: z.string().min(1).nullish(),
    workProjectId: workProjectIdSchema,
    decision: z.enum(['approved', 'denied']),
    resolutionReason: z.string().max(MAX_HALL_CHANGE_REQUEST_REASON_LENGTH).nullable(),
  }).strict(),
  z.object({
    type: z.literal('admin_announcement'),
    title: titleSchema,
    message: notificationMessageSchema,
  }).strict(),
  z.object({
    type: z.literal('followed_content_published'),
    workProjectId: workProjectIdSchema,
    workTitle: titleSchema,
    hallItemId: hallItemIdSchema,
    hallItemTitle: titleSchema,
    hallSubItemType: HallSubItemTypeSchema,
  }).strict(),
  // P7 Hall-publish MEMBER job — same Hall-publication fields as the follower type (it describes
  // the SAME publication to the work's members; the work route + "your work was published!" copy
  // are set by the emitter via targetPath/title, not metadata).
  z.object({
    type: z.literal('member_content_published'),
    workProjectId: workProjectIdSchema,
    workTitle: titleSchema,
    hallItemId: hallItemIdSchema,
    hallItemTitle: titleSchema,
    hallSubItemType: HallSubItemTypeSchema,
  }).strict(),
  // P7 craft-skill publish — points at the artisan whose skills updated. The actor name
  // ("X uploaded new craft skills") + the profile/skills route resolve from `artisanUid` at
  // render time (Display Identity Invariant); `staticRelight` shows no count.
  z.object({
    type: z.literal('followed_craft_skill_published'),
    artisanUid: userIdSchema,
  }).strict(),
  // Reporter feedback — metadata is deliberately minimal: `reportId` is the
  // reporter's OWN report-root doc id (deterministic per reporterUid + target,
  // see writeOrdinaryReport), used only as the dedup/aggregation key so a
  // reporter gets at most one card per report they filed. NO fields that
  // identify the reported user/content/remedy may ever be added here.
  z.object({
    type: z.literal('report_action_taken'),
    reportId: reportIdSchema,
  }).strict(),
  // Appellant feedback for a content-appeal decision. `appealId` is the
  // appellant's OWN appeal doc id (the dedup/aggregation key — one card per
  // appeal, a re-decision coalesces); `decision` drives the card copy.
  z.object({
    type: z.literal('content_appeal_reviewed'),
    appealId: appealIdSchema,
    decision: z.enum(['approved', 'denied']),
  }).strict(),
]);
export type NotificationMetadataByType = z.infer<typeof NotificationMetadataByTypeSchema>;

// ============================================================================
// BROADCAST AUDIENCE SELECTOR
// ============================================================================

/**
 * Admin broadcast audience selector. Stored on a broadcast job; the scheduled
 * fan-out worker resolves a page of it into uids (domain-aware queries live in
 * ttt-prod — the package only ever receives uids).
 */
export const BroadcastAudienceSelectorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('allActiveUsers') }).strict(),
  z.object({
    kind: z.literal('explicitUids'),
    // The selector's documented audience cap (dedup + serialized-byte enforcement
    // for work/realm snapshots is app-side). Derives from the ONE named constant.
    uids: z.array(userIdSchema).min(1).max(MAX_BROADCAST_EXPLICIT_UIDS),
  }).strict(),
  z.object({
    kind: z.literal('workMembers'),
    workProjectId: workProjectIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('realmMembers'),
    workRealmId: workRealmIdSchema,
  }).strict(),
  z.object({ kind: z.literal('allArtisans') }).strict(),
]);
export type BroadcastAudienceSelector = z.infer<typeof BroadcastAudienceSelectorSchema>;

// ============================================================================
// CALLABLE INPUT SCHEMAS
// ============================================================================

export const CreateNotificationBroadcastInputSchema = z.object({
  // Client-generated idempotency key — the app derives the broadcast eventId
  // deterministically from (actorUid, requestId) so a lost-ack retry is idempotent.
  requestId: z.string().min(1),
  selector: BroadcastAudienceSelectorSchema,
  title: titleSchema,
  message: notificationMessageSchema,
}).strict();
export type CreateNotificationBroadcastInput = z.infer<typeof CreateNotificationBroadcastInputSchema>;

/** Archive scope: a single notification, or the caller's whole category. */
export const ArchiveNotificationScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('single'), notificationId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('all') }).strict(),
]);
export type ArchiveNotificationScope = z.infer<typeof ArchiveNotificationScopeSchema>;

// No `device` field on the archive input — archive metadata is server-derived (A1).
export const ArchiveNotificationInputSchema = z.object({
  category: NotificationCategorySchema,
  scope: ArchiveNotificationScopeSchema,
}).strict();
export type ArchiveNotificationInput = z.infer<typeof ArchiveNotificationInputSchema>;

// Shared admin notifications have no per-admin seen state, so only the personal
// `user` category can be marked seen.
export const MarkNotificationsSeenInputSchema = z.object({
  category: z.literal('user'),
}).strict();
export type MarkNotificationsSeenInput = z.infer<typeof MarkNotificationsSeenInputSchema>;

// ============================================================================
// OBSERVED-GENERATION CALLABLE INPUT SCHEMAS (P6 tray)
//
// These are for the NEW observed-generation callables the P6 notification tray
// will invoke. The LEGACY schemas above (MarkNotificationsSeenInputSchema /
// ArchiveNotificationInputSchema) remain intact — the legacy callables still use
// them.
// ============================================================================

// Max items per mark-seen call matches a sane notification tray page size.
const MARK_SEEN_MAX_ITEMS = 50;

/**
 * A single rendered notification row and the generation the UI observed.
 * `activeId` is the Firestore active-notification document id;
 * `observedActivityGeneration` is the opaque token from that document.
 */
const SeenItemSchema = z.object({
  activeId: z.string().min(1),
  observedActivityGeneration: z.string().min(1),
}).strict();

/**
 * Input for the new observed-generation mark-seen callable (P6 tray).
 *
 * The UI sends only the rows it actually rendered plus their observed
 * `activityGeneration` tokens. The server sets `seenAt = now` ONLY when the
 * card's current `activityGeneration` matches `observedActivityGeneration`;
 * otherwise it is a no-op for that row (activity arrived after render, or a
 * delete+recreate rotated the token).
 *
 * category is always `'user'` — shared admin notifications have no per-admin
 * seen state.
 */
export const MarkNotificationsSeenObservedInputSchema = z.object({
  category: z.literal('user'),
  items: z.array(SeenItemSchema).min(1).max(MARK_SEEN_MAX_ITEMS),
}).strict();
export type MarkNotificationsSeenObservedInput = z.infer<typeof MarkNotificationsSeenObservedInputSchema>;

/**
 * Archive scope for the observed-generation callable.
 *
 * `single` — archive one notification card. Carries `notificationId` (the
 *   active-card doc id) and `observedActivityGeneration` (the precondition:
 *   the server archives only if the card's current generation matches).
 *
 * `all` — archive every card in the category. The per-card generation
 *   precondition is applied server-side per card during bounded-page sweeps;
 *   the caller supplies no single generation token here because there is no
 *   single observed generation for the whole category. (Design choice: archive-all
 *   carries no observedActivityGeneration at the top level; the server reads each
 *   card's current generation as its own precondition. This is consistent with the
 *   NOTIFICATIONS_REDESIGN "mark-all/archive-all run bounded pages with stable
 *   cursors until exhausted" protocol and the archive-history identity formula
 *   which keys each occurrence on requestId independently.)
 */
export const ArchiveNotificationObservedScopeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('single'),
    notificationId: z.string().min(1),
    observedActivityGeneration: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('all'),
  }).strict(),
]);
export type ArchiveNotificationObservedScope = z.infer<typeof ArchiveNotificationObservedScopeSchema>;

/**
 * Input for the observed-generation archive callable (P6 tray).
 *
 * `requestId` is a per-call nonce — the tray mints a fresh uuid on every archive /
 * clear-all click, so it is NOT a replay-stability token (R39). Idempotency is provided
 * by ACTIVE-DOC DELETION: a replay finds the card already gone and no-ops, so an archive
 * never double-applies. The server combines `requestId` with the card's `activeId` to
 * form the deterministic history doc id (`hash('notification-archive', category,
 * audienceScope, requestId:activeId)`), so a single archive can never collide on another
 * card's history doc (R35).
 *
 * `category` scopes which active-notification collection is archived
 * (`activeUserNotifications` vs `activeAdminNotifications`) and forms part of
 * the history doc path.
 */
export const ArchiveNotificationObservedInputSchema = z.object({
  requestId: z.string().min(1),
  category: NotificationCategorySchema,
  scope: ArchiveNotificationObservedScopeSchema,
}).strict();
export type ArchiveNotificationObservedInput = z.infer<typeof ArchiveNotificationObservedInputSchema>;

// ============================================================================
// SERVER-OWNED ARCHIVE-ALL JOB (replaces the browser clear-all loop)
//
// `enqueueArchiveAll` enqueues ONE durable archive-all job scoped to the tab's
// category (idempotent per user+category+requestId) and returns { jobId }; the
// bounded server worker drains that category's active cards each in its own
// atomic archive+audit txn (per-card observed-generation precondition preserved).
// `getArchiveAllStatus` is polled by the thin client hook. Per-tab scoping is
// REQUIRED — a job only ever archives its own category, never all tabs.
// ============================================================================

export const EnqueueArchiveAllInputSchema = z.object({
  requestId: z.string().min(1),
  category: NotificationCategorySchema,
}).strict();
export type EnqueueArchiveAllInput = z.infer<typeof EnqueueArchiveAllInputSchema>;

export const GetArchiveAllStatusInputSchema = z.object({
  jobId: z.string().min(1),
}).strict();
export type GetArchiveAllStatusInput = z.infer<typeof GetArchiveAllStatusInputSchema>;

// Wire contract for the `resumeFanoutJob` callable — the admin console re-arms a
// dead-lettered notification fanout job by id. Admin console-invoked, but still a
// wire contract, so it lives here (callable-validation convention) rather than as a
// local schema in the functions repo.
export const ResumeFanoutJobInputSchema = z.object({
  jobId: notificationFanoutJobIdSchema,
}).strict();
export type ResumeFanoutJobInput = z.infer<typeof ResumeFanoutJobInputSchema>;

// ============================================================================
// AUDIT EVENT PAYLOADS (admin-only)
// ============================================================================

/**
 * Payload of a `notification.broadcastSent` audit event — written when an admin
 * enqueues a broadcast. Actor mode is `adminReview` / `adminOverride`. Records
 * the selector (never a pre-resolved uid list) + the job it created.
 */
export interface NotificationBroadcastSentAuditMetadata {
  jobId: string;
  selector: BroadcastAudienceSelector;
  title: string;
}

/**
 * Payload of a `notification.adminArchived` audit event — written when an admin
 * clears a shared admin notification (the `handledBy` action). Actor mode is
 * `adminReview` / `adminOverride`.
 */
export interface NotificationAdminArchivedAuditMetadata {
  scope: 'single' | 'all';
  /** Present for single-archive; absent for a category-wide `all` archive. */
  notificationId?: string;
  handledBy: string;
}
