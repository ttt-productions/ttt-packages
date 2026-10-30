import { z } from 'zod';
import { parseNotificationArchiveAllJobId } from '../ids/notification-ids.js';
import {
  ADMIN_NOTIFICATION_CATEGORY,
  NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS,
} from '../types/notifications.js';
import { countSchema } from '../doc-schemas/atoms.js';

export const adminNotificationIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{1,128}$/, 'Not a notification id.');

export const activityGenerationSchema = z.string().min(1).max(128);

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
