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

export const LeagueTeamCreatedNotificationMetadataSchema = z
  .object({ leagueId: leagueIdSchema, teamId: teamIdSchema })
  .strict();
export type LeagueTeamCreatedNotificationMetadata = z.infer<
  typeof LeagueTeamCreatedNotificationMetadataSchema
>;

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

export function isAdminNotificationMetadata(
  type: AdminNotificationType,
  metadata: unknown,
): boolean {
  return ADMIN_NOTIFICATION_METADATA_SCHEMAS[type].safeParse(metadata).success;
}

const METADATA_MISMATCH = {
  message: "The metadata is not the notification type's.",
  path: ['metadata'],
};

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

export const AdminNotificationHistorySchema = z.object({
  archiveOccurrenceId: z.string().min(1),
  requestId: z.string().min(1),
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
  actorId: userIdSchema.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  occurrenceAt: epochMsSchema,
});
export type NotificationDeliveryPayload = z.infer<typeof NotificationDeliveryPayloadSchema>;

export const NotificationDeliverySchema = z
  .object({
    deliveryId: z.string().min(1),
    state: z.enum(NOTIFICATION_DELIVERY_STATE_KEYS),
    notificationType: adminNotificationTypeSchema,
    eventId: z.string().min(1),
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

export const NotificationArchiveAllJobSchema = z.object({
  jobId: z.string().min(1),
  userId: userIdSchema,
  category: z.literal(ADMIN_NOTIFICATION_CATEGORY),
  state: z.enum(NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS),
  revision: countSchema,
  archived: countSchema,
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
