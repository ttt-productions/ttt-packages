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
  guildChatChannelIdSchema,
  adminDispatchIdSchema,
  hallItemIdSchema,
  thresholdItemIdSchema,
  titleSchema,
} from './atoms.js';
import { TRADE_PROFESSION_OPTIONS } from '../constants/options.js';

// String shape atoms specific to notifications.
const notificationMessageSchema = z.string().min(1).max(2000);
const channelNameSchema = z.string().min(1).max(200);
const reportedItemTypeSchema = z.string().min(1).max(64);
const reportedItemIdSchema = z.string().min(1).max(128);
const reportGroupIdSchema = z.string().min(1);
const workRealmIdSchema = z.string().min(1);

const TRADE_PROFESSION_VALUES = [...TRADE_PROFESSION_OPTIONS] as [string, ...string[]];

// ============================================================================
// TYPE + CHANNEL CATALOG
// ============================================================================

export const NOTIFICATION_TYPE_VALUES = [
  'content_report',
  'content_report_csam',
  'guild_invite',
  'guild_chat_message',
  'admin_dispatch_reply',
  'threshold_library_submission',
  'admin_announcement',
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
  content_report_csam: { category: 'admin', delivery: 'realtime', defaultChannels: ['inApp'] },
  guild_invite: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  guild_chat_message: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  admin_dispatch_reply: { category: 'user', delivery: 'realtime', defaultChannels: ['inApp'] },
  threshold_library_submission: { category: 'admin', delivery: 'queued', defaultChannels: ['inApp'] },
  admin_announcement: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
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
    type: z.literal('content_report_csam'),
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
    type: z.literal('guild_chat_message'),
    workProjectId: workProjectIdSchema,
    channelId: guildChatChannelIdSchema,
    channelName: channelNameSchema,
  }).strict(),
  z.object({
    type: z.literal('admin_dispatch_reply'),
    adminDispatchId: adminDispatchIdSchema,
  }).strict(),
  z.object({
    type: z.literal('threshold_library_submission'),
    thresholdItemId: thresholdItemIdSchema,
    hallItemId: hallItemIdSchema,
    workProjectId: workProjectIdSchema,
  }).strict(),
  z.object({
    type: z.literal('admin_announcement'),
    title: titleSchema,
    message: notificationMessageSchema,
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
    uids: z.array(userIdSchema).min(1).max(10_000),
  }).strict(),
  z.object({
    kind: z.literal('workMembers'),
    workProjectId: workProjectIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('realmMembers'),
    workRealmId: workRealmIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('artisansByRole'),
    tradeProfession: z.enum(TRADE_PROFESSION_VALUES),
  }).strict(),
]);
export type BroadcastAudienceSelector = z.infer<typeof BroadcastAudienceSelectorSchema>;

// ============================================================================
// CALLABLE INPUT SCHEMAS
// ============================================================================

export const CreateNotificationBroadcastInputSchema = z.object({
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

// No `device` field — it was dropped from the package's ArchivalInfo (A1).
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
