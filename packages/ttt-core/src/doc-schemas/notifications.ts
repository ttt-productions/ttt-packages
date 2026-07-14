// Registry schemas for the notification-core-owned Firestore docs as stored in TTT:
// activeUserNotifications/{id} + activeAdminNotifications/{id} (NotificationDoc),
// adminNotificationHistory/{id} + userProfiles/{uid}/notificationHistory/{id}
// (the archived-history wrapper), pendingNotifications/{id} (PendingNotification).
//
// @ttt-productions/notification-core OWNS the generic NotificationDoc and
// PendingNotification shapes AND their schemas; ttt-core composes those schemas
// here (single owner — no hand-mirroring, so drift is impossible). The history
// doc has no consumer-facing package type (the server archive helper builds it as
// an untyped wrapper), so NotificationHistoryDocSchema below is its canonical
// shape and stays owned by ttt-core.

import { z } from 'zod';
import {
  NotificationDocSchema as NotificationDocSchemaBase,
  PendingNotificationSchema as PendingNotificationSchemaBase,
} from '@ttt-productions/notification-core';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

// TTT stores the generic shapes verbatim (no TTT-specific field refinements), so
// these re-export notification-core's canonical schemas under ttt-core's stable
// registry names. If TTT ever refines a field, compose via `.extend`/`.merge` on
// the base schema rather than re-declaring it here.
export const NotificationDocSchema = NotificationDocSchemaBase;
export const PendingNotificationSchema = PendingNotificationSchemaBase;

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
