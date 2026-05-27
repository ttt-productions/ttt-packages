import { z } from 'zod';
import { violationIdSchema, auditionIdSchema, auditionEntryIdSchema } from './atoms.js';
import { MAX_APPEAL_MESSAGE_LENGTH, MAX_FEEDBACK_SUGGESTION_LENGTH, FEEDBACK_TYPES } from '../constants/business.js';

export const AcceptViolationDecisionInputSchema = z.object({
  violationId: violationIdSchema,
}).strict();
export type AcceptViolationDecisionInput = z.infer<typeof AcceptViolationDecisionInputSchema>;

export const CreateShortLinkInputSchema = z.object({
  auditionId: auditionIdSchema,
  auditionEntryId: auditionEntryIdSchema.optional(),
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
  feedbackType: z.enum(FEEDBACK_TYPES),
  suggestion: z.string().min(1).max(MAX_FEEDBACK_SUGGESTION_LENGTH).regex(/^[a-z]+$/),
}).strict();
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>;

export const TrackShortLinkClickInputSchema = z.object({
  shortId: z.string().min(1).max(64),
}).strict();
export type TrackShortLinkClickInput = z.infer<typeof TrackShortLinkClickInputSchema>;

export const MarkAdminDispatchReadInputSchema = z.object({
  adminDispatchId: z.string().min(1).max(128),
}).strict();
export type MarkAdminDispatchReadInput = z.infer<typeof MarkAdminDispatchReadInputSchema>;

