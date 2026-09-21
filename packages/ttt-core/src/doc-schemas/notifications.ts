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

// The STORED active-card body. `id` is the Firestore document id, injected at read
// (COLLECTION_DOC_ID_FIELDS) and never persisted — both materializers write the card
// without it. Derived from the one card schema so there is a single definition of the
// card and one of "the card as stored".
export const StoredNotificationCardSchema = NotificationDocSchema.omit({ id: true });

// Archived history doc = the wrapper persisted by notification-core's server archive
// helper (server/observed-generation.ts): the active card's stored body copied verbatim
// under `archivedSnapshot`, plus archive metadata and a native-TTL `expireAt` Timestamp
// (native TTL only honors a real Firestore Timestamp — never epoch-ms). The snapshot is
// a nested copy, so nothing injects a document id into it — it is the stored shape.
export const NotificationHistoryDocSchema = z.object({
  archiveOccurrenceId: z.string(),
  requestId: z.string(),
  payloadHash: z.string(),
  activeId: z.string(),
  observedActivityGeneration: z.string(),
  category: z.string(),
  audienceScope: z.string(),
  archivedSnapshot: StoredNotificationCardSchema,
  archivedAt: z.number(),
  expireAt: FirestoreTimestampSchema,
  handledBy: z.string().optional(),
});
