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
  storedTitleSchema,
  reportGroupIdSchema,
  mediaAssetIdSchema,
  workRealmIdSchema,
  realmFileShareRequestIdSchema,
  documentIdSegmentSchema,
  activeNotificationIdSchema,
  unpaddedValueSchema,
} from './atoms.js';
import { MAX_HALL_CHANGE_REQUEST_REASON_LENGTH } from '../constants/business-content.js';
import {
  MAX_THRESHOLD_REVIEW_NOTES_LENGTH,
  MAX_NOTIFICATION_MESSAGE_LENGTH,
  MAX_BROADCAST_EXPLICIT_UIDS,
} from '../constants/business-admin.js';
import { BROADCAST_MESSAGE_INPUT, BROADCAST_TITLE_INPUT } from '../constants/text-fields.js';
import { HallSubItemTypeSchema } from '../doc-schemas/content.js';
import { textFieldSchema } from './text-field.js';
import { ReportableItemTypeSchema } from '../doc-schemas/safety/foundation.js';
import { NotificationFanoutPrioritySchema } from '../doc-schemas/notification-ledger.js';

const storedNotificationMessageSchema = z.string().min(1).max(MAX_NOTIFICATION_MESSAGE_LENGTH);
const reportedItemTypeSchema = ReportableItemTypeSchema;
const reportedItemIdSchema = documentIdSegmentSchema.max(128);
const reportIdSchema = documentIdSegmentSchema;
const appealIdSchema = documentIdSegmentSchema;

export const NOTIFICATION_TYPE_VALUES = [
  'content_report',
  'guild_invite',
  'admin_dispatch_reply',
  'admin_dispatch_created',
  'threshold_library_submission',
  'threshold_library_reviewed',
  'hall_content_change_request_resolved',
  'admin_announcement',
  'followed_content_published',
  'member_content_published',
  'followed_craft_skill_published',
  'report_action_taken',
  'content_appeal_reviewed',
  'realm_file_share_requested',
  'realm_file_share_resolved',
] as const;

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPE_VALUES);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const RELIABLE_NOTIFICATION_TYPES = [
  'content_report',
  'admin_dispatch_reply',
  'admin_dispatch_created',
  'guild_invite',
  'threshold_library_submission',
  'threshold_library_reviewed',
  'hall_content_change_request_resolved',
  'report_action_taken',
  'content_appeal_reviewed',
  'realm_file_share_requested',
  'realm_file_share_resolved',
] as const satisfies readonly NotificationType[];
export type ReliableNotificationType = (typeof RELIABLE_NOTIFICATION_TYPES)[number];

export const REALTIME_RELIABLE_NOTIFICATION_TYPES = [
  'content_report',
  'admin_dispatch_reply',
  'admin_dispatch_created',
] as const satisfies readonly ReliableNotificationType[];

export const NOTIFICATION_CHANNEL_VALUES = ['inApp', 'email', 'push'] as const;
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNEL_VALUES);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export type NotificationCategory = 'user' | 'admin';
export const NotificationCategorySchema = z.enum(['user', 'admin']);

export interface NotificationTypeCatalogEntry {
  category: NotificationCategory;
  delivery: 'realtime' | 'queued';
  defaultChannels: NotificationChannel[];
}

export const NOTIFICATION_TYPE_CATALOG: Record<NotificationType, NotificationTypeCatalogEntry> = {
  content_report: { category: 'admin', delivery: 'realtime', defaultChannels: ['inApp'] },
  guild_invite: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  admin_dispatch_reply: { category: 'user', delivery: 'realtime', defaultChannels: ['inApp'] },
  admin_dispatch_created: { category: 'user', delivery: 'realtime', defaultChannels: ['inApp'] },
  threshold_library_submission: {
    category: 'admin',
    delivery: 'queued',
    defaultChannels: ['inApp'],
  },
  threshold_library_reviewed: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  hall_content_change_request_resolved: {
    category: 'user',
    delivery: 'queued',
    defaultChannels: ['inApp'],
  },
  admin_announcement: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  followed_content_published: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  member_content_published: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  followed_craft_skill_published: {
    category: 'user',
    delivery: 'queued',
    defaultChannels: ['inApp'],
  },
  report_action_taken: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  content_appeal_reviewed: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  realm_file_share_requested: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
  realm_file_share_resolved: { category: 'user', delivery: 'queued', defaultChannels: ['inApp'] },
};

export const NotificationMetadataByTypeSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('content_report'),
      reportGroupId: reportGroupIdSchema,
      reportedItemType: reportedItemTypeSchema,
      reportedItemId: reportedItemIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('guild_invite'),
      workProjectId: workProjectIdSchema,
      guildInviteId: guildInviteIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('admin_dispatch_reply'),
      adminDispatchId: adminDispatchIdSchema,
      partyKind: z.enum(['user', 'workProject']).optional(),
      workProjectId: workProjectIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('admin_dispatch_created'),
      adminDispatchId: adminDispatchIdSchema,
      partyKind: z.enum(['user', 'workProject']),
      workProjectId: workProjectIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('threshold_library_submission'),
      thresholdItemId: thresholdItemIdSchema,
      hallItemId: hallItemIdSchema,
      workProjectId: workProjectIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('threshold_library_reviewed'),
      thresholdItemId: thresholdItemIdSchema,
      hallItemId: hallItemIdSchema,
      workProjectId: workProjectIdSchema,
      workProjectType: workProjectTypeSchema,
      itemId: z.string().min(1),
      decision: z.literal('needs_revision'),
      adminNotes: z.string().max(MAX_THRESHOLD_REVIEW_NOTES_LENGTH).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('hall_content_change_request_resolved'),
      changeRequestId: changeRequestIdSchema,
      hallItemId: hallItemIdSchema.nullable(),
      workRealmId: z.string().min(1).nullish(),
      workProjectId: workProjectIdSchema,
      decision: z.enum(['approved', 'denied']),
      resolutionReason: z.string().max(MAX_HALL_CHANGE_REQUEST_REASON_LENGTH).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('admin_announcement'),
      title: storedTitleSchema,
      message: storedNotificationMessageSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('followed_content_published'),
      workProjectId: workProjectIdSchema,
      workRealmId: workRealmIdSchema.optional(),
      workTitle: storedTitleSchema,
      hallItemId: hallItemIdSchema,
      hallItemTitle: storedTitleSchema,
      hallSubItemType: HallSubItemTypeSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('member_content_published'),
      workProjectId: workProjectIdSchema,
      workRealmId: workRealmIdSchema.optional(),
      workTitle: storedTitleSchema,
      hallItemId: hallItemIdSchema,
      hallItemTitle: storedTitleSchema,
      hallSubItemType: HallSubItemTypeSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('followed_craft_skill_published'),
      artisanUid: userIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('report_action_taken'),
      reportId: reportIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('content_appeal_reviewed'),
      appealId: appealIdSchema,
      decision: z.enum(['approved', 'denied']),
    })
    .strict(),
  z
    .object({
      type: z.literal('realm_file_share_requested'),
      workRealmId: workRealmIdSchema,
      workProjectId: workProjectIdSchema,
      mediaAssetId: mediaAssetIdSchema,
      workFileId: z.string().min(1),
      requestId: realmFileShareRequestIdSchema,
      requestedByUid: userIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('realm_file_share_resolved'),
      workRealmId: workRealmIdSchema,
      workProjectId: workProjectIdSchema,
      mediaAssetId: mediaAssetIdSchema,
      workFileId: z.string().min(1),
      requestId: realmFileShareRequestIdSchema,
      resolution: z.enum(['approved', 'declined', 'withdrawn']),
    })
    .strict(),
]);
export type NotificationMetadataByType = z.infer<typeof NotificationMetadataByTypeSchema>;

export function validateNotificationMetadata(
  type: NotificationType,
  metadata: Record<string, unknown>,
): NotificationMetadataByType {
  if (Object.prototype.hasOwnProperty.call(metadata, 'type')) {
    throw new TypeError('Notification metadata must not carry its own type.');
  }
  return NotificationMetadataByTypeSchema.parse({ ...metadata, type });
}

export const BroadcastAudienceSelectorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('allActiveUsers') }).strict(),
  z
    .object({
      kind: z.literal('explicitUids'),
      uids: z.array(userIdSchema).min(1).max(MAX_BROADCAST_EXPLICIT_UIDS),
    })
    .strict(),
  z
    .object({
      kind: z.literal('workMembers'),
      workProjectId: workProjectIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('realmMembers'),
      workRealmId: workRealmIdSchema,
    })
    .strict(),
  z.object({ kind: z.literal('allArtisans') }).strict(),
]);
export type BroadcastAudienceSelector = z.infer<typeof BroadcastAudienceSelectorSchema>;

const clientRequestIdSchema = unpaddedValueSchema;

export const CreateNotificationBroadcastInputSchema = z
  .object({
    requestId: clientRequestIdSchema,
    selector: BroadcastAudienceSelectorSchema,
    title: textFieldSchema(BROADCAST_TITLE_INPUT),
    message: textFieldSchema(BROADCAST_MESSAGE_INPUT),
  })
  .strict();
export type CreateNotificationBroadcastInput = z.infer<
  typeof CreateNotificationBroadcastInputSchema
>;

export const CreateNotificationBroadcastResultSchema = z.object({
  success: z.literal(true),
  jobId: z.string().min(1),
});
export type CreateNotificationBroadcastResult = z.infer<
  typeof CreateNotificationBroadcastResultSchema
>;

export const MarkNotificationsSeenInputSchema = z
  .object({
    category: z.literal('user'),
  })
  .strict();
export type MarkNotificationsSeenInput = z.infer<typeof MarkNotificationsSeenInputSchema>;

const MARK_SEEN_MAX_ITEMS = 50;

const SeenItemSchema = z
  .object({
    activeId: activeNotificationIdSchema,
    observedActivityGeneration: z.string().min(1),
  })
  .strict();

export const MarkNotificationsSeenObservedInputSchema = z
  .object({
    category: z.literal('user'),
    items: z.array(SeenItemSchema).min(1).max(MARK_SEEN_MAX_ITEMS),
  })
  .strict();
export type MarkNotificationsSeenObservedInput = z.infer<
  typeof MarkNotificationsSeenObservedInputSchema
>;

export const MarkNotificationsSeenResultSchema = z.object({
  success: z.literal(true),
  updated: z.number().int().nonnegative(),
});
export type MarkNotificationsSeenResult = z.infer<typeof MarkNotificationsSeenResultSchema>;

export const ArchiveNotificationObservedScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('single'),
      notificationId: activeNotificationIdSchema,
      observedActivityGeneration: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('all'),
    })
    .strict(),
]);
export type ArchiveNotificationObservedScope = z.infer<
  typeof ArchiveNotificationObservedScopeSchema
>;

export const ArchiveNotificationObservedInputSchema = z
  .object({
    requestId: clientRequestIdSchema,
    scope: ArchiveNotificationObservedScopeSchema,
  })
  .strict();
export type ArchiveNotificationObservedInput = z.infer<
  typeof ArchiveNotificationObservedInputSchema
>;

export const ArchiveNotificationResultSchema = z.object({
  success: z.literal(true),
  archived: z.number().int().nonnegative(),
  hasMore: z.boolean().optional(),
});
export type ArchiveNotificationResult = z.infer<typeof ArchiveNotificationResultSchema>;

export const EnqueueArchiveAllInputSchema = z
  .object({
    requestId: clientRequestIdSchema,
  })
  .strict();
export type EnqueueArchiveAllInput = z.infer<typeof EnqueueArchiveAllInputSchema>;

export const GetArchiveAllStatusInputSchema = z
  .object({
    jobId: documentIdSegmentSchema,
  })
  .strict();
export type GetArchiveAllStatusInput = z.infer<typeof GetArchiveAllStatusInputSchema>;

export const ResumeFanoutJobInputSchema = z
  .object({
    jobId: notificationFanoutJobIdSchema,
  })
  .strict();
export type ResumeFanoutJobInput = z.infer<typeof ResumeFanoutJobInputSchema>;

export const DeadLetteredFanoutJobRowSchema = z.object({
  jobId: notificationFanoutJobIdSchema,
  notificationType: z.string(),
  priority: NotificationFanoutPrioritySchema,
  deadLetteredAt: z.number().nullable(),
  lastError: z.string().nullable(),
  ageMs: z.number().nullable(),
});
export type DeadLetteredFanoutJobRow = z.infer<typeof DeadLetteredFanoutJobRowSchema>;

export const ListDeadLetteredFanoutJobsInputSchema = z.object({}).strict();
export type ListDeadLetteredFanoutJobsInput = z.infer<typeof ListDeadLetteredFanoutJobsInputSchema>;

export const ListDeadLetteredFanoutJobsResultSchema = z.object({
  jobs: z.array(DeadLetteredFanoutJobRowSchema),
});
export type ListDeadLetteredFanoutJobsResult = z.infer<
  typeof ListDeadLetteredFanoutJobsResultSchema
>;

export const ResumeFanoutJobResultSchema = z.object({
  resumed: z.boolean(),
  reason: z.string().optional(),
});
export type ResumeFanoutJobResult = z.infer<typeof ResumeFanoutJobResultSchema>;

export interface NotificationBroadcastSentAuditMetadata {
  jobId: string;
  selector: BroadcastAudienceSelector;
  title: string;
}

export interface NotificationAdminArchivedAuditMetadata {
  scope: 'single' | 'all';
  notificationId?: string;
  handledBy: string;
}

export interface NotificationAdminArchiveAllRequestedAuditMetadata {
  jobId: string;
  requestId: string;
}
