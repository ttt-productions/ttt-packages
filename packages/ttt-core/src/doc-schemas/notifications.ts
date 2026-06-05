// Registry schemas for the notification-core-owned Firestore docs as stored in TTT:
// activeUserNotifications/{id} + activeAdminNotifications/{id} (NotificationDoc),
// adminNotificationHistory/{id} + userProfiles/{uid}/notificationHistory/{id}
// (NotificationHistoryDoc), pendingNotifications/{id} (PendingNotification).
// Canonical TYPES live in @ttt-productions/notification-core; parity is asserted in
// parity.test.ts so these schemas cannot silently drift from the package types.

import { z } from 'zod';
import { BroadcastAudienceSelectorSchema } from '../schemas/notification.js';

export const NotificationDocSchema = z.object({
  id: z.string(),
  type: z.string(),
  dedupKey: z.string(),
  category: z.string(),
  targetUserId: z.string().nullable(),
  title: z.string(),
  message: z.string(),
  count: z.number(),
  latestActorIds: z.array(z.string()),
  targetPath: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  seenAt: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ArchivalInfoSchema = z.object({
  archivedBy: z.string(),
  archivedAt: z.number(),
});

export const NotificationHistoryDocSchema = NotificationDocSchema.extend({
  archival: ArchivalInfoSchema,
  expireAt: z.number(),
  handledBy: z.string().optional(),
});

export const PendingNotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  category: z.string(),
  targetUserId: z.string().nullable(),
  actorId: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
});

// followerReleaseJobs/{jobId} — Cloud-Functions-only fan-out job: enqueueFollowerReleaseJob (post
// Hall-publish) → processFollowerReleaseJobs drains Work followers, then canon-Realm followers.
// (functions/src/notifications/followerReleaseJobs.ts)
export const FollowerReleaseJobSchema = z.object({
  jobId: z.string(),
  workProjectId: z.string(),
  workTitle: z.string(),
  hallItemId: z.string(),
  hallItemTitle: z.string(),
  hallSubItemType: z.enum(['chapter', 'track', 'episode']),
  stewardUid: z.string(),
  canonRealmId: z.string().nullable(),
  status: z.enum(['pending', 'complete', 'failed']),
  phase: z.enum(['work', 'realm']),
  cursor: z.string().nullable(),
  totalSent: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type FollowerReleaseJob = z.infer<typeof FollowerReleaseJobSchema>;

// notificationBroadcastJobs/{jobId} — Cloud-Functions-only admin-broadcast fan-out job:
// createNotificationBroadcast stores the audience selector (never a resolved uid list);
// processNotificationBroadcastJobs drains it. (functions/src/notifications/createNotificationBroadcast.ts)
export const NotificationBroadcastJobSchema = z.object({
  jobId: z.string(),
  selector: BroadcastAudienceSelectorSchema,
  title: z.string(),
  message: z.string(),
  actorUid: z.string(),
  // ctx.admin (a SystemRole role string); modeled loosely — SystemRole is a ttt-prod-only union.
  actorSystemRole: z.string().optional(),
  status: z.enum(['pending', 'complete', 'failed']),
  cursor: z.string().nullable(),
  totalSent: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type NotificationBroadcastJob = z.infer<typeof NotificationBroadcastJobSchema>;
