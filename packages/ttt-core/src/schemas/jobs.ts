import { z } from 'zod';
import { jobIdSchema, replyIdSchema } from './atoms.js';

export const AcceptJobApplicantInputSchema = z.object({
  jobId: jobIdSchema,
  replyId: replyIdSchema,
  sharesOffered: z.number().int().min(1),
}).strict();
export type AcceptJobApplicantInput = z.infer<typeof AcceptJobApplicantInputSchema>;

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
