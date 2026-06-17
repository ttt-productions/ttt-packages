// Registry schemas for the notification-core-owned Firestore docs as stored in TTT:
// activeUserNotifications/{id} + activeAdminNotifications/{id} (NotificationDoc),
// adminNotificationHistory/{id} + userProfiles/{uid}/notificationHistory/{id}
// (NotificationHistoryDoc), pendingNotifications/{id} (PendingNotification).
// Canonical TYPES live in @ttt-productions/notification-core; parity is asserted in
// parity.test.ts so these schemas cannot silently drift from the package types.

import { z } from 'zod';

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
  // Opaque per-generation token rotated on create / material re-light; the
  // SEEN/ARCHIVE precondition (notification redesign). Optional on the legacy
  // doc shape; the ledger materializer always sets it.
  activityGeneration: z.string().optional(),
  seenAtGeneration: z.string().optional(),
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

