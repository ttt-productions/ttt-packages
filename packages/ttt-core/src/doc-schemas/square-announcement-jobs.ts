import { z } from 'zod';
import { SquareStreetzPostTypeSchema, SquareStreetzPostPayloadSchema } from './social.js';
import type { SquareStreetzPostType } from './social.js';

export function buildSquareAnnouncementJobId(
  announcementType: SquareStreetzPostType,
  primaryDocId: string,
): string {
  return `${announcementType}_${primaryDocId}`;
}

export const SquareAnnouncementPayloadSchema = SquareStreetzPostPayloadSchema.extend({
  projectId: z.string().optional(),
  postId: z.string().optional(),
});
export type SquareAnnouncementPayload = z.infer<typeof SquareAnnouncementPayloadSchema>;

export const SquareAnnouncementInputSchema = z.object({
  type: SquareStreetzPostTypeSchema,
  payload: SquareAnnouncementPayloadSchema,
});
export type SquareAnnouncementInput = z.infer<typeof SquareAnnouncementInputSchema>;

export const SquareAnnouncementJobStatusSchema = z.enum([
  'pending',
  'processing',
  'delivered',
  'dead',
]);
export type SquareAnnouncementJobStatus = z.infer<typeof SquareAnnouncementJobStatusSchema>;

export const SquareAnnouncementJobSchema = z
  .object({
    jobId: z.string().min(1),
    announcement: SquareAnnouncementInputSchema,
    source: z.record(z.string(), z.string()),
    status: SquareAnnouncementJobStatusSchema,
    attemptCount: z.number().int().nonnegative(),
    lastError: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type SquareAnnouncementJob = z.infer<typeof SquareAnnouncementJobSchema>;
