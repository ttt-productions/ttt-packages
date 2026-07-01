// Registry schemas for the notification-core-owned Firestore docs as stored in TTT:
// activeUserNotifications/{id} + activeAdminNotifications/{id} (NotificationDoc),
// adminNotificationHistory/{id} + userProfiles/{uid}/notificationHistory/{id}
// (the archived-history wrapper), pendingNotifications/{id} (PendingNotification).
// NotificationDoc/PendingNotification TYPES live in @ttt-productions/notification-core;
// the history doc has no consumer-facing package type (the server archive helper builds
// it as an untyped wrapper), so NotificationHistoryDocSchema below is its canonical shape.
// These schemas mirror the package's shapes by hand — there is currently no parity test
// enforcing that they stay in sync; a drift here would go unnoticed until it broke
// something at runtime.

import { z } from 'zod';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

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

// Archived history doc = the wrapper persisted by notification-core's server archive
// helper (server/observed-generation.ts): the full active notification nested under
// `archivedSnapshot`, plus archive metadata and a native-TTL `expireAt` Timestamp
// (native TTL only honors a real Firestore Timestamp — never epoch-ms).
export const NotificationHistoryDocSchema = z.object({
  archiveOccurrenceId: z.string(),
  requestId: z.string(),
  payloadHash: z.string(),
  activeId: z.string(),
  observedActivityGeneration: z.string(),
  category: z.string(),
  audienceScope: z.string(),
  archivedSnapshot: NotificationDocSchema,
  archivedAt: z.number(),
  expireAt: FirestoreTimestampSchema,
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

