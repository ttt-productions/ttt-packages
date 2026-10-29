// Callable contracts for the shared admin notifications: archiving one, archiving all of them,
// and reading how an archive-all is going. The occurrences the delivery worker gave up on are listed
// and replayed through the operator's dead letters (./dead-letters.ts). Admin only; a card is never
// created by a client — the callable that owns each notified action writes its occurrence
// (RULE-STD-BACKEND-306).

import { z } from 'zod';
import { parseNotificationArchiveAllJobId } from '../ids/notification-ids.js';
import {
  ADMIN_NOTIFICATION_CATEGORY,
  NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS,
} from '../types/notifications.js';
import { countSchema } from '../doc-schemas/atoms.js';

// A card's document id as notification-core derives it: a hex digest. Bounding it to letters and
// digits keeps a client-sent id from addressing anything but a document of the card collection.
export const adminNotificationIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{1,128}$/, 'Not a notification id.');

// The opaque generation token a card carried when the admin saw it. An action on the card applies
// only while the card still carries it, so activity that arrived after the admin looked is never
// archived unseen.
export const activityGenerationSchema = z.string().min(1).max(128);

// A fresh UUID per click. An archive's history entry and an archive-all's job are keyed by it, so a
// retry of the same click lands on what the first attempt wrote.
export const notificationRequestIdSchema = z.uuid();

export const notificationArchiveAllJobIdSchema = z
  .string()
  .refine((id) => parseNotificationArchiveAllJobId(id) !== null, 'Not an archive-all job id.');

export const AdminArchiveNotificationInputSchema = z
  .object({
    requestId: notificationRequestIdSchema,
    notificationId: adminNotificationIdSchema,
    observedActivityGeneration: activityGenerationSchema,
  })
  .strict();
export type AdminArchiveNotificationInput = z.infer<typeof AdminArchiveNotificationInputSchema>;
// `archived` is false when there was nothing to archive at the generation named: another admin
// archived the card first, or new activity lit it again, and it stays on the list.
export const AdminArchiveNotificationResultSchema = z.object({ archived: z.boolean() }).strict();
export type AdminArchiveNotificationResult = z.infer<typeof AdminArchiveNotificationResultSchema>;

export const AdminArchiveAllNotificationsInputSchema = z
  .object({ requestId: notificationRequestIdSchema })
  .strict();
export type AdminArchiveAllNotificationsInput = z.infer<
  typeof AdminArchiveAllNotificationsInputSchema
>;
export const AdminArchiveAllNotificationsResultSchema = z
  .object({ jobId: notificationArchiveAllJobIdSchema })
  .strict();
export type AdminArchiveAllNotificationsResult = z.infer<
  typeof AdminArchiveAllNotificationsResultSchema
>;

export const AdminGetNotificationArchiveAllStatusInputSchema = z
  .object({ jobId: notificationArchiveAllJobIdSchema })
  .strict();
export type AdminGetNotificationArchiveAllStatusInput = z.infer<
  typeof AdminGetNotificationArchiveAllStatusInputSchema
>;
// notification-core's archive-all snapshot: the job's state, the category it drains, how many
// cards it has archived, and — on a completed job that left cards behind — how many it could not.
// A job that ran out of attempts with cards left reads as `incomplete`.
export const AdminGetNotificationArchiveAllStatusResultSchema = z
  .object({
    state: z.enum(NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS),
    category: z.literal(ADMIN_NOTIFICATION_CATEGORY),
    archived: countSchema,
    notArchived: countSchema.optional(),
    error: z.string().optional(),
  })
  .strict();
export type AdminGetNotificationArchiveAllStatusResult = z.infer<
  typeof AdminGetNotificationArchiveAllStatusResultSchema
>;
