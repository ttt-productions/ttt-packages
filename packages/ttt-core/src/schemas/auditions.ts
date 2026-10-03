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


// getOwnAuditionEntryStatus — the caller's OWN entry on one audition, answered server-side because
// an entry moderation hid is unreadable to everyone, its owner included. The answer says only
// whether the caller has an entry and whether it is under moderation review — never the entry,
// its content, or why it was hidden.
export const GetOwnAuditionEntryStatusInputSchema = z.object({
  auditionId: auditionIdSchema,
}).strict();
export type GetOwnAuditionEntryStatusInput = z.infer<typeof GetOwnAuditionEntryStatusInputSchema>;

/** `none` — no entry; `visible` — an entry the caller can read; `underReview` — an entry moderation hid. */
export const OWN_AUDITION_ENTRY_STATUS_VALUES = ['none', 'visible', 'underReview'] as const;
export const OwnAuditionEntryStatusSchema = z.enum(OWN_AUDITION_ENTRY_STATUS_VALUES);
export type OwnAuditionEntryStatus = z.infer<typeof OwnAuditionEntryStatusSchema>;

export const GetOwnAuditionEntryStatusResultSchema = z.object({
  auditionId: auditionIdSchema,
  entryStatus: OwnAuditionEntryStatusSchema,
});
export type GetOwnAuditionEntryStatusResult = z.infer<typeof GetOwnAuditionEntryStatusResultSchema>;
