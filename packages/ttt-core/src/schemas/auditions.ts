import { z } from 'zod';
import { auditionIdSchema, auditionEntryIdSchema, workProjectIdSchema } from './atoms.js';

export const CloseAuditionInputSchema = z
  .object({
    auditionId: auditionIdSchema,
  })
  .strict();
export type CloseAuditionInput = z.infer<typeof CloseAuditionInputSchema>;

export const CloseAuditionResultSchema = z.object({
  success: z.literal(true),
  auditionId: auditionIdSchema,
  workProjectId: workProjectIdSchema,
});
export type CloseAuditionResult = z.infer<typeof CloseAuditionResultSchema>;

export const CreateAuditionEntryAcceptedResultSchema = z.object({
  success: z.literal(true),
  auditionId: auditionIdSchema,
  pendingMediaId: z.string().min(1),
  auditionEntryId: auditionEntryIdSchema,
});
export type CreateAuditionEntryAcceptedResult = z.infer<
  typeof CreateAuditionEntryAcceptedResultSchema
>;

export const GetOwnAuditionEntryStatusInputSchema = z
  .object({
    auditionId: auditionIdSchema,
  })
  .strict();
export type GetOwnAuditionEntryStatusInput = z.infer<typeof GetOwnAuditionEntryStatusInputSchema>;

export const OWN_AUDITION_ENTRY_STATUS_VALUES = ['none', 'visible', 'underReview'] as const;
export const OwnAuditionEntryStatusSchema = z.enum(OWN_AUDITION_ENTRY_STATUS_VALUES);
export type OwnAuditionEntryStatus = z.infer<typeof OwnAuditionEntryStatusSchema>;

export const GetOwnAuditionEntryStatusResultSchema = z.object({
  auditionId: auditionIdSchema,
  entryStatus: OwnAuditionEntryStatusSchema,
});
export type GetOwnAuditionEntryStatusResult = z.infer<typeof GetOwnAuditionEntryStatusResultSchema>;
