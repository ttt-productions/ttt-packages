// The admin notification documents: the shared cards, their archived history, the delivery ledger
// the owning callables write occurrences into, and the archive-all jobs. Every one is written only by
// Cloud Functions.
//
// notification-core owns the generic card shape, so the card schema is composed from its
// `NotificationDocSchema` and narrowed to Q-Sports' one shared category and its notification types.
// The history, ledger, and job documents are written by notification-core's server helpers and by
// the functions around them; their schemas are declared here because the package exports no schema
// for them. A card, a history entry, and a ledger row each hold ids only, never a name (ARCH-103).
//
// `expireAt` is the one Firestore `Timestamp` any of them holds: a native-TTL policy honours only a
// real Timestamp, and nothing reads the field for display or order (ARCH-105).

import { z } from 'zod';
import { NotificationDocSchema } from '@ttt-productions/notification-core';
import {
  ADMIN_NOTIFICATION_CATEGORY,
  ADMIN_NOTIFICATION_TYPE_KEYS,
  NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS,
  NOTIFICATION_DELIVERY_PAYLOAD_VERSION,
  NOTIFICATION_DELIVERY_SKIP_REASON_KEYS,
  NOTIFICATION_DELIVERY_STATE_KEYS,
  NOTIFICATION_MATERIALIZATION_CLASS_KEYS,
  SHARED_NOTIFICATION_AUDIENCE_SCOPE,
} from '../types/notifications.js';
import type { AdminNotificationType } from '../types/notifications.js';
import { countSchema, epochMsSchema, leagueIdSchema, teamIdSchema, userIdSchema } from './atoms.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

export const adminNotificationTypeSchema = z.enum(ADMIN_NOTIFICATION_TYPE_KEYS);

// What each type's card and ledger row name, by id. The card's title, link, and every name it shows
// are derived from these at read time.
export const LeagueTeamCreatedNotificationMetadataSchema = z
  .object({ leagueId: leagueIdSchema, teamId: teamIdSchema })
  .strict();
export type LeagueTeamCreatedNotificationMetadata = z.infer<typeof LeagueTeamCreatedNotificationMetadataSchema>;

export const LeagueFreeAgentSignedUpNotificationMetadataSchema = z
  .object({ leagueId: leagueIdSchema, userId: userIdSchema })
  .strict();
export type LeagueFreeAgentSignedUpNotificationMetadata = z.infer<
  typeof LeagueFreeAgentSignedUpNotificationMetadataSchema
>;

export const ADMIN_NOTIFICATION_METADATA_SCHEMAS = {
  leagueTeamCreated: LeagueTeamCreatedNotificationMetadataSchema,
  leagueFreeAgentSignedUp: LeagueFreeAgentSignedUpNotificationMetadataSchema,
} as const satisfies Record<AdminNotificationType, z.ZodTypeAny>;

export type AdminNotificationMetadataByType = {
  [T in AdminNotificationType]: z.infer<(typeof ADMIN_NOTIFICATION_METADATA_SCHEMAS)[T]>;
};

/** Whether `metadata` is the metadata `type` declares. */
export function isAdminNotificationMetadata(type: AdminNotificationType, metadata: unknown): boolean {
  return ADMIN_NOTIFICATION_METADATA_SCHEMAS[type].safeParse(metadata).success;
}

const METADATA_MISMATCH = { message: "The metadata is not the notification type's.", path: ['metadata'] };

// activeAdminNotifications/{notificationId} — one shared card, as notification-core stores it. The id
// is notification-core's, hashed from the type and the aggregation key, and is not a field: a reader
// is handed it beside the document. `seenAt` is the package's field: a shared card has no seen state,
// so no admin marks it and it stays 0.
export const ActiveAdminNotificationSchema = NotificationDocSchema.omit({ id: true })
  .extend({
    type: adminNotificationTypeSchema,
    category: z.literal(ADMIN_NOTIFICATION_CATEGORY),
    targetUserId: z.null(),
    count: countSchema,
    latestActorIds: z.array(userIdSchema),
    seenAt: epochMsSchema,
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
  })
  .refine((card) => isAdminNotificationMetadata(card.type, card.metadata), METADATA_MISMATCH);
export type ActiveAdminNotification = z.infer<typeof ActiveAdminNotificationSchema>;

// adminNotificationHistory/{historyId} — an archived card: the card as it stood when archived, kept
// whole under `archivedSnapshot`, with who archived it and the archive's replay facts.
export const AdminNotificationHistorySchema = z.object({
  archiveOccurrenceId: z.string().min(1),
  requestId: z.string().min(1),
  // The archive's replay key: the card and the generation the archiving admin saw.
  payloadHash: z.string().min(1),
  activeId: z.string().min(1),
  observedActivityGeneration: z.string().min(1),
  category: z.literal(ADMIN_NOTIFICATION_CATEGORY),
  audienceScope: z.literal(SHARED_NOTIFICATION_AUDIENCE_SCOPE),
  archivedSnapshot: ActiveAdminNotificationSchema,
  archivedAt: epochMsSchema,
  expireAt: FirestoreTimestampSchema,
  handledBy: userIdSchema,
});
export type AdminNotificationHistory = z.infer<typeof AdminNotificationHistorySchema>;

export const NotificationDeliveryPayloadSchema = z.object({
  // Who did what the occurrence records; null for an occurrence with no acting account.
  actorId: userIdSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  occurrenceAt: epochMsSchema,
});
export type NotificationDeliveryPayload = z.infer<typeof NotificationDeliveryPayloadSchema>;

// notificationDeliveries/{deliveryId} — one occurrence: the queue row the worker materializes and the
// record that it happened, in one document, so the occurrence and its delivery cannot come apart.
// Written in the owning callable's own transaction. A queued or dead-lettered row never expires:
// notification-core sets `expireAt` only when the row materializes or is skipped, and an admin's
// replay of a dead-lettered row sets it back to null. A row is skipped only when it names a recipient
// who may no longer receive, which no Q-Sports row does; the skip's fields are declared because the
// package writes them.
export const NotificationDeliverySchema = z
  .object({
    deliveryId: z.string().min(1),
    state: z.enum(NOTIFICATION_DELIVERY_STATE_KEYS),
    notificationType: adminNotificationTypeSchema,
    eventId: z.string().min(1),
    // Every Q-Sports notification is shared, so no row names a recipient.
    recipientUid: z.null(),
    aggregationKey: z.string().min(1),
    strategy: z.literal('increment'),
    payload: NotificationDeliveryPayloadSchema,
    payloadVersion: z.literal(NOTIFICATION_DELIVERY_PAYLOAD_VERSION),
    materializationClass: z.enum(NOTIFICATION_MATERIALIZATION_CLASS_KEYS),
    createdAt: epochMsSchema,
    attemptCount: countSchema,
    nextAttemptAt: epochMsSchema,
    lastError: z.string().nullable(),
    materializedAt: epochMsSchema.nullable(),
    deadLetteredAt: epochMsSchema.nullable(),
    skipReason: z.enum(NOTIFICATION_DELIVERY_SKIP_REASON_KEYS).optional(),
    skippedAt: epochMsSchema.optional(),
    expireAt: FirestoreTimestampSchema.nullable().optional(),
  })
  .refine((row) => isAdminNotificationMetadata(row.notificationType, row.payload.metadata), {
    message: METADATA_MISMATCH.message,
    path: ['payload', 'metadata'],
  });
export type NotificationDelivery = z.infer<typeof NotificationDeliverySchema>;

// notificationArchiveAllJobs/{jobId} — one admin's "archive all": the server drains every active card
// in pages until none is left, whether or not that admin's browser is still open. Backend-only: the
// admin learns its state through the status callable. A completed job expires; one that is still
// running, stopped short, or failed never does.
export const NotificationArchiveAllJobSchema = z.object({
  jobId: z.string().min(1),
  // The admin who asked. Each card the job archives is recorded as archived by them; the event the
  // request wrote when the job was created carries the request's origin (BACKEND-211).
  userId: userIdSchema,
  category: z.literal(ADMIN_NOTIFICATION_CATEGORY),
  state: z.enum(NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS),
  // Moves on every claim, so an overlapping run that claimed an older revision cannot settle the job.
  revision: countSchema,
  archived: countSchema,
  // The cards the COMPLETING drain could not archive — each failed on its own and is still in the
  // list. Set (never summed) when the job completes, because that drain walked the whole active set
  // once. Optional, never defaulted: absent until a job completes with cards left behind, read as 0.
  notArchived: countSchema.optional(),
  error: z.string().nullable(),
  attemptCount: countSchema,
  nextAttemptAt: epochMsSchema,
  deadLettered: z.boolean(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  completedAt: epochMsSchema.nullable(),
  deadLetteredAt: epochMsSchema.nullable(),
  expireAt: FirestoreTimestampSchema.optional(),
});
export type NotificationArchiveAllJob = z.infer<typeof NotificationArchiveAllJobSchema>;
