import { z } from 'zod';
import { violationIdSchema, opportunityIdSchema, replyIdSchema } from './atoms.js';
import { MAX_APPEAL_MESSAGE_LENGTH, MAX_FEEDBACK_SUGGESTION_LENGTH } from '../constants/business.js';

export const AcceptViolationDecisionInputSchema = z.object({
  violationId: violationIdSchema,
}).strict();
export type AcceptViolationDecisionInput = z.infer<typeof AcceptViolationDecisionInputSchema>;

export const CreateShortLinkInputSchema = z.object({
  opportunityId: opportunityIdSchema,
  replyId: replyIdSchema.optional(),
}).strict();
export type CreateShortLinkInput = z.infer<typeof CreateShortLinkInputSchema>;

export const InitProfanityListInputSchema = z.object({}).strict();
export type InitProfanityListInput = z.infer<typeof InitProfanityListInputSchema>;

export const SubmitContentAppealInputSchema = z.object({
  violationId: violationIdSchema,
  appealMessage: z.string().min(1).max(MAX_APPEAL_MESSAGE_LENGTH),
}).strict();
export type SubmitContentAppealInput = z.infer<typeof SubmitContentAppealInputSchema>;

export const SubmitFeedbackInputSchema = z.object({
  feedbackType: z.string().min(1),
  suggestion: z.string().min(1).max(MAX_FEEDBACK_SUGGESTION_LENGTH).regex(/^[a-z]+$/),
}).strict();
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;
