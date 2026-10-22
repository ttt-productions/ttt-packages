import { z } from 'zod';
import { NotificationCategorySchema } from '../schemas/notification.js';
import { systemRoleSchema } from '../schemas/atoms.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

export const NotificationArchiveAllJobStateSchema = z.enum([
  'in-progress',
  'complete',
  'incomplete',
  'failed',
]);
export type NotificationArchiveAllJobState = z.infer<typeof NotificationArchiveAllJobStateSchema>;

// `.passthrough()` so future additive fields don't fail read-side validation.
export const NotificationArchiveAllJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: z.string().min(1),
    userId: z.string().min(1),
    category: NotificationCategorySchema,
    actorSystemRole: systemRoleSchema.nullable().optional(),
    state: NotificationArchiveAllJobStateSchema,
    revision: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative(),
    notArchived: z.number().int().nonnegative().optional(),
    error: z.string().nullable(),
    attemptCount: z.number().int().nonnegative(),
    nextAttemptAt: z.number().int().nonnegative(),
    deadLettered: z.boolean(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    completedAt: z.number().int().nullable(),
    deadLetteredAt: z.number().int().nullable(),
    expireAt: FirestoreTimestampSchema.optional(),
  })
  .passthrough();

export type NotificationArchiveAllJob = z.infer<typeof NotificationArchiveAllJobSchema>;
