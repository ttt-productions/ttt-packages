import { z } from 'zod';
import {
  NotificationDocSchema as NotificationDocSchemaBase,
  PendingNotificationSchema as PendingNotificationSchemaBase,
} from '@ttt-productions/notification-core';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

export const NotificationDocSchema = NotificationDocSchemaBase;
export const PendingNotificationSchema = PendingNotificationSchemaBase;

export const StoredNotificationCardSchema = NotificationDocSchema.omit({ id: true });

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
