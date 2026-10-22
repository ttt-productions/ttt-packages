import { z } from 'zod';
import type { NotificationDoc, PendingNotification } from './types.js';

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
  targetPath: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
  seenAt: z.number(),
  activityGeneration: z.string().optional(),
  seenAtGeneration: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}) satisfies z.ZodType<NotificationDoc>;

export const PendingNotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  category: z.string(),
  targetUserId: z.string().nullable(),
  actorId: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
}) satisfies z.ZodType<PendingNotification>;
