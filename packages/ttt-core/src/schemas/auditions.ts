import { z } from 'zod';
import { auditionIdSchema, auditionEntryIdSchema } from './atoms.js';

export const CloseAuditionInputSchema = z.object({
  auditionId: auditionIdSchema,
}).strict();
export type CloseAuditionInput = z.infer<typeof CloseAuditionInputSchema>;

// Acceptance result of the audition-entry CREATE flow (startUpload with fileOrigin
// 'audition-entry'). Creation itself is asynchronous via the media pipeline; the entry
// doc id is the CALLER's uid (one entry per user — processAuditionMedia writes
// auditionEntryId: userId), so it is knowable at accept time without any read.
// Non-strict (server → client result posture).
export const CreateAuditionEntryAcceptedResultSchema = z.object({
  success: z.literal(true),
  auditionId: auditionIdSchema,
  pendingMediaId: z.string().min(1),
  /** The eventual entry doc id — the caller's uid. */
  auditionEntryId: auditionEntryIdSchema,
});
export type CreateAuditionEntryAcceptedResult = z.infer<typeof CreateAuditionEntryAcceptedResultSchema>;


