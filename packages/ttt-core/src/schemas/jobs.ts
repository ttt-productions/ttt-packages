import { z } from 'zod';
import { jobIdSchema, replyIdSchema } from './atoms.js';
import { MAX_JOB_DESCRIPTION_LENGTH } from '../constants/business.js';

export const JobApplicationStatusSchema = z.enum([
  'open',
  'invited',
  'accepted',
  'rejected',
]);
export type JobApplicationStatus = z.infer<typeof JobApplicationStatusSchema>;

export const CloseJobInputSchema = z.object({
  jobId: jobIdSchema,
}).strict();
export type CloseJobInput = z.infer<typeof CloseJobInputSchema>;

export const DeleteJobInputSchema = z.object({
  jobId: jobIdSchema,
}).strict();
export type DeleteJobInput = z.infer<typeof DeleteJobInputSchema>;

export const RejectJobApplicantInputSchema = z.object({
  jobId: jobIdSchema,
  replyId: replyIdSchema,
}).strict();
export type RejectJobApplicantInput = z.infer<typeof RejectJobApplicantInputSchema>;

export const SetJobApplicantSavedInputSchema = z.object({
  jobId: jobIdSchema,
  replyId: replyIdSchema,
  saved: z.boolean(),
}).strict();
export type SetJobApplicantSavedInput = z.infer<typeof SetJobApplicantSavedInputSchema>;

export const CreateJobReplyTextInputSchema = z.object({
  jobId: jobIdSchema,
  coverLetterText: z.string().min(1).max(MAX_JOB_DESCRIPTION_LENGTH),
}).strict();
export type CreateJobReplyTextInput = z.infer<typeof CreateJobReplyTextInputSchema>;
