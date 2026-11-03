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

export const AdminUpdateAdminNotificationArchiveInputSchema = z
  .object({
    requestId: notificationRequestIdSchema,
    notificationId: adminNotificationIdSchema,
    observedActivityGeneration: activityGenerationSchema,
  })
  .strict();
export type AdminUpdateAdminNotificationArchiveInput = z.infer<
  typeof AdminUpdateAdminNotificationArchiveInputSchema
>;
export const AdminUpdateAdminNotificationArchiveResultSchema = z
  .object({ archived: z.boolean() })
  .strict();
export type AdminUpdateAdminNotificationArchiveResult = z.infer<
  typeof AdminUpdateAdminNotificationArchiveResultSchema
>;

export const AdminCreateNotificationArchiveAllJobInputSchema = z
  .object({ requestId: notificationRequestIdSchema })
  .strict();
export type AdminCreateNotificationArchiveAllJobInput = z.infer<
  typeof AdminCreateNotificationArchiveAllJobInputSchema
>;
export const AdminCreateNotificationArchiveAllJobResultSchema = z
  .object({ jobId: notificationArchiveAllJobIdSchema })
  .strict();
export type AdminCreateNotificationArchiveAllJobResult = z.infer<
  typeof AdminCreateNotificationArchiveAllJobResultSchema
>;

export const AdminGetNotificationArchiveAllJobInputSchema = z
  .object({ jobId: notificationArchiveAllJobIdSchema })
  .strict();
export type AdminGetNotificationArchiveAllJobInput = z.infer<
  typeof AdminGetNotificationArchiveAllJobInputSchema
>;
export const AdminGetNotificationArchiveAllJobResultSchema = z
  .object({
    state: z.enum(NOTIFICATION_ARCHIVE_ALL_JOB_STATE_KEYS),
    category: z.literal(ADMIN_NOTIFICATION_CATEGORY),
    archived: countSchema,
    notArchived: countSchema.optional(),
    error: z.string().optional(),
  })
  .strict();
export type AdminGetNotificationArchiveAllJobResult = z.infer<
  typeof AdminGetNotificationArchiveAllJobResultSchema
>;
